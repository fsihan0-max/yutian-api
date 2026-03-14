from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import json
import rasterio
from rasterio.io import MemoryFile
from rasterio.mask import mask
from rasterio.warp import transform_geom
from shapely.geometry import Polygon
from pystac_client import Client
from skimage.feature import graycomatrix, graycoprops
from skimage.measure import shannon_entropy

app = Flask(__name__)
CORS(app)

# 对接 AWS 上的免费公共 STAC 卫星目录 (包含 Sentinel-2 真实多光谱数据)
STAC_API_URL = "https://earth-search.aws.element84.com/v1"

@app.route('/api/analyze', methods=['POST'])
def analyze_damage():
    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    has_file = is_multipart and 'file' in request.files

    print("="*60)
    
    # 获取前端传来的经纬度坐标多边形
    geom_data = request.form.get('geometry') if is_multipart else request.get_json().get('geometry')
    area_mu = float(request.form.get('area_mu', 0)) if is_multipart else float(request.get_json().get('area_mu', 0))
    
    if not geom_data:
        return jsonify({"error": "未接收到空间坐标！"}), 400

    geom_json = json.loads(geom_data) if isinstance(geom_data, str) else geom_data
    geojson_poly = {"type": "Polygon", "coordinates": geom_json.get('rings', [])}

    # ==========================================
    # 模式 A：用户上传了无人机高分影像 (微观模式)
    # ==========================================
    if has_file:
        print("【引擎 A：无人机 DOM 模式】收到前端上传的高分影像...")
        engine_type = "用户提供: 无人机高分影像"
        file = request.files['file']
        
        try:
            with MemoryFile(file.read()) as memfile:
                with memfile.open() as dataset:
                    tiff_crs = dataset.crs
                    reprojected_poly = transform_geom('EPSG:4326', tiff_crs, geojson_poly)
                    out_image, out_transform = mask(dataset, [reprojected_poly], crop=True)
                    
                    if dataset.count >= 4:
                        red, nir = out_image[2].astype(float), out_image[3].astype(float)
                    else:
                        red, nir = out_image[0].astype(float), out_image[1].astype(float)
                        
                    return process_pixels(red, nir, out_image[0], area_mu, engine_type)
        except Exception as e:
            return jsonify({"error": f"无人机影像解析失败: {str(e)}"}), 500

    # ==========================================
    # 模式 B：未上传文件，自动对接云端真实卫星 (宏观模式)
    # ==========================================
    else:
        print("【引擎 B：云端真实卫星模式】正在对接 AWS Sentinel-2 卫星接口...")
        engine_type = "云端直连: Sentinel-2 真实多光谱"
        
        try:
            # 1. 搜索该坐标区域最近的、云量少于 20% 的卫星影像
            catalog = Client.open(STAC_API_URL)
            search = catalog.search(
                collections=["sentinel-2-l2a"],
                intersects=geojson_poly,
                query={"eo:cloud_cover": {"lt": 20}}, # 云量小于 20%
                max_items=1
            )
            items = list(search.items())
            
            if not items:
                return jsonify({"error": "该区域近期无清晰的卫星影像，请手动上传无人机影像。"}), 404
                
            item = items[0]
            print(f"✅ 成功锁定卫星影像！拍摄时间: {item.datetime}")
            
            # 2. 获取真实的红光和近红外波段在云端的下载链接 (COG格式)
            red_url = item.assets["red"].href
            nir_url = item.assets["nir"].href
            
            # 3. 核心黑科技：不下载整张图，只在内存中读取多边形内的像素！
            print("正在流式拉取红光与近红外底层像素...")
            with rasterio.open(red_url) as src_red:
                reprojected_poly = transform_geom('EPSG:4326', src_red.crs, geojson_poly)
                red_data, _ = mask(src_red, [reprojected_poly], crop=True)
                
            with rasterio.open(nir_url) as src_nir:
                nir_data, _ = mask(src_nir, [reprojected_poly], crop=True)
                
            # 拿到像素后，直接送入处理函数
            return process_pixels(red_data[0].astype(float), nir_data[0].astype(float), red_data[0], area_mu, engine_type)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": f"对接公开卫星数据源失败: {str(e)}"}), 500

# ==========================================
# 核心算力池：真实 NDVI 与 GLCM 计算逻辑
# ==========================================
def process_pixels(red, nir, gray_band, area_mu, engine_type):
    np.seterr(divide='ignore', invalid='ignore')
    ndvi = (nir - red) / (nir + red)
    
    valid_mask = (red != 0) | (nir != 0)
    valid_ndvi = ndvi[valid_mask]
    
    if len(valid_ndvi) == 0:
        return jsonify({"error": "计算失败：该图斑内无有效数据"}), 400

    damage_ratio_float = float(np.sum(valid_ndvi < 0.35) / len(valid_ndvi))
    damaged_mu = area_mu * damage_ratio_float

    min_val, max_val = gray_band[valid_mask].min(), gray_band[valid_mask].max()
    gray_8bit = np.uint8(255 * (gray_band - min_val) / (max_val - min_val)) if max_val > min_val else np.zeros_like(gray_band, dtype=np.uint8)

    glcm = graycomatrix(gray_8bit, distances=[1], angles=[0], levels=256, symmetric=True, normed=True)
    real_contrast = float(graycoprops(glcm, 'contrast')[0, 0])
    real_entropy = float(shannon_entropy(gray_8bit[valid_mask]))

    cause_analysis = "自然灾害 (高频纹理/定向倒伏)" if real_contrast > 80.0 or real_entropy > 6.5 else "疑似管理不善 (平滑低熵/缺水病害)"

    return jsonify({
        "status": "success",
        "engine_type": engine_type,
        "total_area_mu": round(area_mu, 2),
        "damaged_area_mu": round(damaged_mu, 2),
        "damage_ratio_float": damage_ratio_float,
        "damage_ratio": f"{round(damage_ratio_float * 100, 1)}%",
        "glcm_metrics": {"contrast": round(real_contrast, 2), "entropy": round(real_entropy, 2), "cause_analysis": cause_analysis}
    })

if __name__ == '__main__':
    print("🚀 豫田智保 (真实卫星对接+无人机双模版) 启动！")
    app.run(host='0.0.0.0', port=5000, debug=True)
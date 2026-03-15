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

STAC_API_URL = "https://earth-search.aws.element84.com/v1"

@app.route('/api/analyze', methods=['POST'])
def analyze_damage():
    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    has_file = is_multipart and 'file' in request.files

    geom_data = request.form.get('geometry') if is_multipart else request.get_json().get('geometry')
    area_mu = float(request.form.get('area_mu', 0)) if is_multipart else float(request.get_json().get('area_mu', 0))
    
    if not geom_data:
        return jsonify({"error": "未接收到空间坐标！"}), 400

    geom_json = json.loads(geom_data) if isinstance(geom_data, str) else geom_data
    geojson_poly = {"type": "Polygon", "coordinates": geom_json.get('rings', [])}

    if has_file:
        engine_type = "用户提供: 无人机高分影像"
        # 无人机上传的图，时间标记为实时
        image_date = "用户实时上传 (无人机本地数据)"
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
                        
                    return process_pixels(red, nir, out_image[0], area_mu, engine_type, image_date)
        except Exception as e:
            return jsonify({"error": f"无人机影像解析失败: {str(e)}"}), 500

    else:
        engine_type = "云端直连: Sentinel-2 真实多光谱"
        try:
            catalog = Client.open(STAC_API_URL)
            search = catalog.search(
                collections=["sentinel-2-l2a"],
                intersects=geojson_poly,
                query={"eo:cloud_cover": {"lt": 20}},
                max_items=1
            )
            items = list(search.items())
            
            if not items:
                return jsonify({"error": "该区域近期无清晰的卫星影像，请手动上传无人机影像。"}), 404
                
            item = items[0]
            # 【重点修改】捕获真实卫星过境成像时间
            image_date = item.datetime.strftime("%Y-%m-%d %H:%M:%S UTC") if item.datetime else "实时获取"
            
            red_url = item.assets["red"].href
            nir_url = item.assets["nir"].href
            
            with rasterio.open(red_url) as src_red:
                reprojected_poly = transform_geom('EPSG:4326', src_red.crs, geojson_poly)
                red_data, _ = mask(src_red, [reprojected_poly], crop=True)
                
            with rasterio.open(nir_url) as src_nir:
                nir_data, _ = mask(src_nir, [reprojected_poly], crop=True)
                
            return process_pixels(red_data[0].astype(float), nir_data[0].astype(float), red_data[0], area_mu, engine_type, image_date)
            
        except Exception as e:
            return jsonify({"error": f"对接公开卫星数据源失败: {str(e)}"}), 500

def process_pixels(red, nir, gray_band, area_mu, engine_type, image_date):
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

    # 【重点修改】逻辑拦截：如果受灾比例极低，直接判定为正常，不输出灾害成因
    if damage_ratio_float < 0.01:
        cause_analysis = "长势良好，未检测到明显灾害特征"
    else:
        cause_analysis = "自然灾害 (高频纹理/定向倒伏)" if real_contrast > 80.0 or real_entropy > 6.5 else "疑似管理不善 (平滑低熵/缺水病害)"

    return jsonify({
        "status": "success",
        "engine_type": engine_type,
        "image_date": image_date,  # 返回成像时间
        "total_area_mu": round(area_mu, 2),
        "damaged_area_mu": round(damaged_mu, 2),
        "damage_ratio_float": damage_ratio_float,
        "damage_ratio": f"{round(damage_ratio_float * 100, 1)}%",
        "glcm_metrics": {"contrast": round(real_contrast, 2), "entropy": round(real_entropy, 2), "cause_analysis": cause_analysis}
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
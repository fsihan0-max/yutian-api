from datetime import datetime, timezone
from pathlib import Path
import json
import math
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.mask import mask
from rasterio.warp import reproject, transform_geom
from pystac_client import Client

app = Flask(__name__)
CORS(app)

STAC_API_URL = "https://earth-search.aws.element84.com/v1"
DATA_DIR = Path(__file__).parent / "data"
SAMPLES_FILE = DATA_DIR / "sample_labels.json"
REVIEWS_FILE = DATA_DIR / "review_records.json"

CLASS_META = {
    "healthy": {"label": "正常长势", "is_disaster": False},
    "pest": {"label": "病虫害", "is_disaster": True},
    "lodging": {"label": "物理倒伏", "is_disaster": True},
    "harvest": {"label": "正常收割", "is_disaster": False},
    "fallow": {"label": "休耕", "is_disaster": False},
    "non_agri": {"label": "非农地物", "is_disaster": False},
}

FEATURE_ORDER = [
    "ndvi",
    "ndre",
    "evi2",
    "ndmi",
    "bsi",
    "contrast",
    "entropy",
    "damage_ratio",
]

FEATURE_LABELS = {
    "ndvi": "NDVI",
    "ndre": "NDRE",
    "evi2": "EVI2",
    "ndmi": "NDMI",
    "bsi": "BSI",
    "contrast": "纹理对比度",
    "entropy": "纹理熵",
    "damage_ratio": "异常像素占比",
}

CROP_CONFIGS = {
    "wheat": {
        "label": "小麦模式",
        "damage_ndvi": 0.42,
        "harvest_ndvi": 0.20,
        "fallow_bsi": 0.12,
        "non_agri_bsi": 0.22,
        "non_agri_ndvi": 0.16,
        "lodging_contrast": 82.0,
        "lodging_entropy": 6.2,
        "pest_ndmi": 0.12,
        "harvest_ndmi": 0.08,
    },
    "corn": {
        "label": "玉米模式",
        "damage_ndvi": 0.52,
        "harvest_ndvi": 0.24,
        "fallow_bsi": 0.16,
        "non_agri_bsi": 0.24,
        "non_agri_ndvi": 0.18,
        "lodging_contrast": 92.0,
        "lodging_entropy": 6.5,
        "pest_ndmi": 0.16,
        "harvest_ndmi": 0.10,
    },
}

SEED_SAMPLES = [
    {"crop_mode": "wheat", "label_key": "healthy", "feature_vector": {"ndvi": 0.71, "ndre": 0.44, "evi2": 0.61, "ndmi": 0.31, "bsi": -0.19, "contrast": 28.0, "entropy": 4.2, "damage_ratio": 0.03}},
    {"crop_mode": "wheat", "label_key": "healthy", "feature_vector": {"ndvi": 0.68, "ndre": 0.41, "evi2": 0.58, "ndmi": 0.28, "bsi": -0.16, "contrast": 31.0, "entropy": 4.4, "damage_ratio": 0.05}},
    {"crop_mode": "wheat", "label_key": "pest", "feature_vector": {"ndvi": 0.35, "ndre": 0.22, "evi2": 0.28, "ndmi": 0.07, "bsi": 0.03, "contrast": 46.0, "entropy": 5.2, "damage_ratio": 0.44}},
    {"crop_mode": "wheat", "label_key": "lodging", "feature_vector": {"ndvi": 0.29, "ndre": 0.16, "evi2": 0.22, "ndmi": 0.05, "bsi": 0.08, "contrast": 118.0, "entropy": 6.9, "damage_ratio": 0.57}},
    {"crop_mode": "wheat", "label_key": "harvest", "feature_vector": {"ndvi": 0.13, "ndre": 0.08, "evi2": 0.09, "ndmi": 0.03, "bsi": 0.06, "contrast": 36.0, "entropy": 4.0, "damage_ratio": 0.08}},
    {"crop_mode": "wheat", "label_key": "fallow", "feature_vector": {"ndvi": 0.08, "ndre": 0.05, "evi2": 0.04, "ndmi": -0.02, "bsi": 0.23, "contrast": 34.0, "entropy": 3.8, "damage_ratio": 0.05}},
    {"crop_mode": "wheat", "label_key": "non_agri", "feature_vector": {"ndvi": 0.05, "ndre": 0.03, "evi2": 0.03, "ndmi": -0.03, "bsi": 0.34, "contrast": 460.0, "entropy": 7.6, "damage_ratio": 0.12}},
    {"crop_mode": "corn", "label_key": "healthy", "feature_vector": {"ndvi": 0.79, "ndre": 0.52, "evi2": 0.68, "ndmi": 0.35, "bsi": -0.22, "contrast": 26.0, "entropy": 4.0, "damage_ratio": 0.03}},
    {"crop_mode": "corn", "label_key": "pest", "feature_vector": {"ndvi": 0.41, "ndre": 0.24, "evi2": 0.31, "ndmi": 0.09, "bsi": 0.04, "contrast": 52.0, "entropy": 5.4, "damage_ratio": 0.39}},
    {"crop_mode": "corn", "label_key": "lodging", "feature_vector": {"ndvi": 0.33, "ndre": 0.18, "evi2": 0.24, "ndmi": 0.07, "bsi": 0.10, "contrast": 128.0, "entropy": 7.1, "damage_ratio": 0.61}},
    {"crop_mode": "corn", "label_key": "harvest", "feature_vector": {"ndvi": 0.15, "ndre": 0.09, "evi2": 0.10, "ndmi": 0.05, "bsi": 0.08, "contrast": 39.0, "entropy": 4.1, "damage_ratio": 0.09}},
    {"crop_mode": "corn", "label_key": "fallow", "feature_vector": {"ndvi": 0.10, "ndre": 0.05, "evi2": 0.05, "ndmi": 0.00, "bsi": 0.27, "contrast": 36.0, "entropy": 3.9, "damage_ratio": 0.04}},
    {"crop_mode": "corn", "label_key": "non_agri", "feature_vector": {"ndvi": 0.06, "ndre": 0.03, "evi2": 0.03, "ndmi": -0.02, "bsi": 0.36, "contrast": 480.0, "entropy": 7.8, "damage_ratio": 0.10}},
]

THEMATIC_META = {
    "ndvi": {"label": "NDVI 专题", "palette": ["#b3432f", "#d2872c", "#245c3e"]},
    "ndre": {"label": "NDRE 专题", "palette": ["#7f3b08", "#d8b365", "#5ab4ac"]},
    "evi2": {"label": "EVI2 专题", "palette": ["#762a83", "#af8dc3", "#7fbf7b"]},
    "ndmi": {"label": "NDMI 专题", "palette": ["#b2182b", "#fddbc7", "#2166ac"]},
    "bsi": {"label": "BSI 专题", "palette": ["#1f3b4d", "#93a8ac", "#d2872c"]},
}


def ensure_data_files():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for path in (SAMPLES_FILE, REVIEWS_FILE):
        if not path.exists():
            path.write_text("[]", encoding="utf-8")


def read_json_list(path: Path):
    ensure_data_files()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_json_list(path: Path, data):
    ensure_data_files()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def utc_now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def safe_mean(values):
    if values.size == 0:
        return 0.0
    return float(np.nanmean(values))


def safe_index(numerator, denominator):
    result = np.full(numerator.shape, np.nan, dtype=float)
    mask = np.isfinite(numerator) & np.isfinite(denominator) & (denominator != 0)
    result[mask] = numerator[mask] / denominator[mask]
    return result


def percentile_clip(values):
    if values.size == 0:
        return 0.0, 0.0
    return float(np.nanpercentile(values, 5)), float(np.nanpercentile(values, 95))


def normalize_feature_vector(feature_vector):
    return np.array([float(feature_vector.get(name, 0.0)) for name in FEATURE_ORDER], dtype=float)


def feature_vector_to_dict(vector):
    return {name: round(float(value), 4) for name, value in zip(FEATURE_ORDER, vector)}


def softmax(values):
    shifted = values - np.max(values)
    exp_values = np.exp(shifted)
    denom = np.sum(exp_values)
    if denom == 0:
        return np.ones_like(values) / len(values)
    return exp_values / denom


def compute_texture_metrics(gray_8bit, valid_mask):
    quantized = np.clip((gray_8bit.astype(np.float32) / 8.0).astype(np.uint8), 0, 31)
    pair_mask = valid_mask[:, :-1] & valid_mask[:, 1:]
    left = quantized[:, :-1][pair_mask]
    right = quantized[:, 1:][pair_mask]

    if left.size == 0:
        return 0.0, 0.0

    glcm = np.zeros((32, 32), dtype=float)
    np.add.at(glcm, (left, right), 1)
    glcm += glcm.T
    total = glcm.sum()
    if total == 0:
        return 0.0, 0.0

    glcm /= total
    rows, cols = np.indices(glcm.shape)
    contrast = float(np.sum(((rows - cols) ** 2) * glcm))

    values = quantized[valid_mask]
    hist = np.bincount(values, minlength=32).astype(float)
    hist /= hist.sum()
    entropy = float(-np.sum(hist[hist > 0] * np.log2(hist[hist > 0])))
    return contrast, entropy


def get_crop_config(crop_mode):
    return CROP_CONFIGS.get(crop_mode, CROP_CONFIGS["wheat"])


def get_request_payload():
    is_multipart = bool(request.content_type and "multipart/form-data" in request.content_type)
    payload = request.form.to_dict() if is_multipart else (request.get_json(silent=True) or {})
    payload["is_multipart"] = is_multipart
    payload["has_file"] = is_multipart and "file" in request.files
    return payload


def resolve_geometry(geometry_raw):
    if not geometry_raw:
        return None
    geom_json = json.loads(geometry_raw) if isinstance(geometry_raw, str) else geometry_raw
    return {"type": "Polygon", "coordinates": geom_json.get("rings", [])}


def extract_drone_bands(dataset, out_image):
    band_count = dataset.count
    blue = out_image[0].astype(float) if band_count >= 1 else np.zeros_like(out_image[0], dtype=float)
    green = out_image[1].astype(float) if band_count >= 2 else np.zeros_like(blue)
    red = out_image[2].astype(float) if band_count >= 3 else out_image[0].astype(float)

    if band_count >= 6:
        rededge = out_image[3].astype(float)
        nir = out_image[4].astype(float)
        swir = out_image[5].astype(float)
    elif band_count == 5:
        rededge = out_image[3].astype(float)
        nir = out_image[4].astype(float)
        swir = (red * 0.7) + (nir * 0.3)
    elif band_count == 4:
        nir = out_image[3].astype(float)
        rededge = (red * 0.45) + (nir * 0.55)
        swir = (red * 0.7) + (nir * 0.3)
    elif band_count >= 2:
        nir = out_image[1].astype(float)
        rededge = (red * 0.5) + (nir * 0.5)
        swir = (red * 0.75) + (nir * 0.25)
    else:
        nir = red.copy()
        rededge = red.copy()
        swir = red.copy()

    return {
        "blue": blue,
        "green": green,
        "red": red,
        "rededge": rededge,
        "nir": nir,
        "swir": swir,
    }


def fetch_stac_bands(geojson_poly):
    catalog = Client.open(STAC_API_URL)
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        intersects=geojson_poly,
        query={"eo:cloud_cover": {"lt": 20}},
        max_items=1,
    )
    items = list(search.items())
    if not items:
        raise ValueError("该区域近期无清晰卫星影像，请上传无人机影像。")

    item = items[0]
    image_date = item.datetime.strftime("%Y-%m-%d %H:%M:%S UTC") if item.datetime else "实时获取"
    asset_names = {
        "blue": "blue",
        "green": "green",
        "red": "red",
        "rededge": "rededge1",
        "nir": "nir",
        "swir": "swir16",
    }

    resolved_assets = {}
    for key, asset_name in asset_names.items():
        asset = item.assets.get(asset_name)
        if asset is None and key == "swir":
            asset = item.assets.get("swir22")
        if asset is None and key == "rededge":
            asset = item.assets.get("rededge2")
        if asset is None:
            raise ValueError(f"卫星资产缺失: {asset_name}")
        resolved_assets[key] = asset

    # Sentinel-2 不同波段分辨率不同，统一重采样到 red 波段网格避免矩阵维度不一致
    ref_asset = resolved_assets["red"]
    with rasterio.open(ref_asset.href) as ref_src:
        ref_poly = transform_geom("EPSG:4326", ref_src.crs, geojson_poly)
        ref_data, ref_transform = mask(ref_src, [ref_poly], crop=True, filled=False)
        ref_array = ref_data[0].astype(np.float32).filled(np.nan)
        ref_shape = ref_array.shape
        ref_crs = ref_src.crs

    bands = {}
    for key, asset in resolved_assets.items():
        with rasterio.open(asset.href) as src:
            src_poly = transform_geom("EPSG:4326", src.crs, geojson_poly)
            src_data, src_transform = mask(src, [src_poly], crop=True, filled=False)
            src_array = src_data[0].astype(np.float32).filled(np.nan)

            if src_array.shape == ref_shape and src.crs == ref_crs and src_transform == ref_transform:
                bands[key] = src_array.astype(float)
                continue

            dst_array = np.full(ref_shape, np.nan, dtype=np.float32)
            reproject(
                source=src_array,
                destination=dst_array,
                src_transform=src_transform,
                src_crs=src.crs,
                src_nodata=np.nan,
                dst_transform=ref_transform,
                dst_crs=ref_crs,
                dst_nodata=np.nan,
                resampling=Resampling.bilinear,
            )
            bands[key] = dst_array.astype(float)

    return bands, image_date


def summarize_index(name, values):
    valid = values[np.isfinite(values)]
    low, high = percentile_clip(valid)
    mean_value = safe_mean(valid)
    if name == "bsi":
        status = "裸土偏高" if mean_value > 0.15 else "地表较稳定"
    else:
        status = "偏低" if mean_value < 0.2 else ("偏高" if mean_value > 0.5 else "中等")

    meta = THEMATIC_META[name]
    return {
        "key": name,
        "label": meta["label"],
        "mean": round(mean_value, 4),
        "low": round(low, 4),
        "high": round(high, 4),
        "status": status,
        "palette": meta["palette"],
    }


def build_rule_result(feature_vector, crop_mode):
    config = get_crop_config(crop_mode)
    ndvi = feature_vector["ndvi"]
    ndmi = feature_vector["ndmi"]
    bsi = feature_vector["bsi"]
    contrast = feature_vector["contrast"]
    entropy = feature_vector["entropy"]
    damage_ratio = feature_vector["damage_ratio"]

    if bsi >= config["non_agri_bsi"] and ndvi <= config["non_agri_ndvi"]:
        label_key = "non_agri"
        score = min(0.99, 0.58 + (bsi - config["non_agri_bsi"]) * 1.8)
        explanation = "BSI 偏高且 NDVI 偏低，地块呈现道路、建筑或裸土特征。"
        feature_scores = {
            "bsi": bsi - config["non_agri_bsi"],
            "ndvi": config["non_agri_ndvi"] - ndvi,
            "contrast": (contrast - 120) / 300,
        }
    elif ndvi <= config["harvest_ndvi"] and bsi >= config["fallow_bsi"]:
        label_key = "fallow"
        score = min(0.95, 0.55 + (bsi - config["fallow_bsi"]) * 1.2)
        explanation = "植被指数偏低且裸土指数偏高，更符合休耕地块状态。"
        feature_scores = {
            "bsi": bsi - config["fallow_bsi"],
            "ndvi": config["harvest_ndvi"] - ndvi,
            "ndmi": config["harvest_ndmi"] - ndmi,
        }
    elif ndvi <= config["harvest_ndvi"] and ndmi <= config["harvest_ndmi"]:
        label_key = "harvest"
        score = min(0.93, 0.56 + (config["harvest_ndvi"] - ndvi) * 1.0)
        explanation = "植被指数与水分指数同步回落，符合正常收割后的光谱特征。"
        feature_scores = {
            "ndvi": config["harvest_ndvi"] - ndvi,
            "ndmi": config["harvest_ndmi"] - ndmi,
            "damage_ratio": max(0.0, 0.25 - damage_ratio),
        }
    elif contrast >= config["lodging_contrast"] or entropy >= config["lodging_entropy"]:
        label_key = "lodging"
        score = min(0.98, 0.62 + max(contrast - config["lodging_contrast"], entropy - config["lodging_entropy"]) / 80)
        explanation = "纹理对比度或熵值明显升高，说明冠层结构被破坏，倾向物理倒伏。"
        feature_scores = {
            "contrast": (contrast - config["lodging_contrast"]) / 60,
            "entropy": entropy - config["lodging_entropy"],
            "damage_ratio": damage_ratio,
        }
    elif ndvi < config["damage_ndvi"] or ndmi < config["pest_ndmi"]:
        label_key = "pest"
        score = min(0.96, 0.58 + max(config["damage_ndvi"] - ndvi, config["pest_ndmi"] - ndmi) * 1.3)
        explanation = "植被指数下降而纹理未明显倒伏，更接近病虫害或生理胁迫造成的异常。"
        feature_scores = {
            "ndvi": config["damage_ndvi"] - ndvi,
            "ndmi": config["pest_ndmi"] - ndmi,
            "damage_ratio": damage_ratio,
        }
    else:
        label_key = "healthy"
        score = min(0.94, 0.58 + max(0.0, ndvi - config["damage_ndvi"]))
        explanation = "主要指数处于健康区间，未出现显著灾损或非灾害状态异常。"
        feature_scores = {
            "ndvi": ndvi,
            "ndre": feature_vector["ndre"],
            "evi2": feature_vector["evi2"],
        }

    top_features = build_top_feature_list_from_scores(feature_scores)
    return {
        "label_key": label_key,
        "label": CLASS_META[label_key]["label"],
        "confidence": round(float(score), 4),
        "explanation": explanation,
        "top_features": top_features,
    }


def build_top_feature_list_from_scores(feature_scores):
    ranked = sorted(feature_scores.items(), key=lambda item: abs(float(item[1])), reverse=True)[:3]
    return [
        {
            "feature": key,
            "label": FEATURE_LABELS.get(key, key),
            "weight": round(float(value), 4),
        }
        for key, value in ranked
    ]


def get_training_samples(crop_mode):
    user_samples = [item for item in read_json_list(SAMPLES_FILE) if item.get("crop_mode") == crop_mode]
    seed_samples = [item for item in SEED_SAMPLES if item.get("crop_mode") == crop_mode]
    return seed_samples + user_samples


def build_ml_result(feature_vector, crop_mode):
    samples = get_training_samples(crop_mode)
    centroids = {}
    for class_key in CLASS_META:
        class_vectors = [
            normalize_feature_vector(item["feature_vector"])
            for item in samples
            if item.get("label_key") == class_key
        ]
        if class_vectors:
            centroids[class_key] = np.mean(class_vectors, axis=0)

    current_vector = normalize_feature_vector(feature_vector)
    distance_pairs = []
    for class_key, centroid in centroids.items():
        distance = float(np.linalg.norm(current_vector - centroid))
        distance_pairs.append((class_key, distance, centroid))

    if not distance_pairs:
        return {
            "label_key": "healthy",
            "label": CLASS_META["healthy"]["label"],
            "confidence": 0.5,
            "explanation": "暂无可用样本，机器学习判定退化为默认健康状态。",
            "top_features": [],
            "probabilities": [],
            "training_sample_count": 0,
        }

    distance_pairs.sort(key=lambda item: item[1])
    labels = [item[0] for item in distance_pairs]
    scores = softmax(-np.array([item[1] for item in distance_pairs]))
    best_label, best_distance, best_centroid = distance_pairs[0]
    second_centroid = distance_pairs[1][2] if len(distance_pairs) > 1 else best_centroid

    feature_deltas = []
    for index, feature_name in enumerate(FEATURE_ORDER):
        best_gap = abs(current_vector[index] - best_centroid[index])
        second_gap = abs(current_vector[index] - second_centroid[index])
        feature_deltas.append((feature_name, second_gap - best_gap))

    top_features = build_top_feature_list_from_scores(dict(feature_deltas))
    probability_list = [
        {"label_key": label, "label": CLASS_META[label]["label"], "probability": round(float(probability), 4)}
        for label, probability in zip(labels, scores)
    ]
    explanation = f"基于样本特征相似度，当前图斑与“{CLASS_META[best_label]['label']}”样本最接近。"

    return {
        "label_key": best_label,
        "label": CLASS_META[best_label]["label"],
        "confidence": round(float(scores[0]), 4),
        "explanation": explanation,
        "top_features": top_features,
        "probabilities": probability_list,
        "training_sample_count": len(samples),
    }


def assemble_analysis_result(bands, area_mu, engine_type, image_date, crop_mode, model_mode):
    config = get_crop_config(crop_mode)
    blue = bands["blue"]
    green = bands["green"]
    red = bands["red"]
    rededge = bands["rededge"]
    nir = bands["nir"]
    swir = bands["swir"]

    valid_mask = np.isfinite(red) & np.isfinite(nir) & ((red != 0) | (nir != 0))
    if not np.any(valid_mask):
        raise ValueError("计算失败：该图斑内无有效数据")

    ndvi = safe_index(nir - red, nir + red)
    ndre = safe_index(nir - rededge, nir + rededge)
    evi2 = 2.5 * safe_index(nir - red, nir + 2.4 * red + 1.0)
    ndmi = safe_index(nir - swir, nir + swir)
    bsi = safe_index((swir + red) - (nir + blue), (swir + red) + (nir + blue))

    gray_band = red
    gray_values = gray_band[valid_mask]
    gray_min = gray_values.min()
    gray_max = gray_values.max()
    if gray_max > gray_min:
        gray_8bit = np.uint8(255 * (gray_band - gray_min) / (gray_max - gray_min))
    else:
        gray_8bit = np.zeros_like(gray_band, dtype=np.uint8)

    contrast, entropy = compute_texture_metrics(gray_8bit, valid_mask)

    damage_mask = valid_mask & np.isfinite(ndvi) & (ndvi < config["damage_ndvi"])
    harvest_mask = valid_mask & np.isfinite(ndvi) & np.isfinite(ndmi) & (ndvi < config["harvest_ndvi"]) & (ndmi < config["harvest_ndmi"])
    fallow_mask = valid_mask & np.isfinite(ndvi) & np.isfinite(bsi) & (ndvi < config["harvest_ndvi"]) & (bsi >= config["fallow_bsi"])
    non_agri_mask = valid_mask & np.isfinite(ndvi) & np.isfinite(bsi) & (ndvi < config["non_agri_ndvi"]) & (bsi >= config["non_agri_bsi"])

    valid_count = int(np.sum(valid_mask))
    damage_ratio = float(np.sum(damage_mask) / valid_count)
    harvest_ratio = float(np.sum(harvest_mask) / valid_count)
    fallow_ratio = float(np.sum(fallow_mask) / valid_count)
    non_agri_ratio = float(np.sum(non_agri_mask) / valid_count)

    thematic_layers = {
        "ndvi": summarize_index("ndvi", ndvi[valid_mask]),
        "ndre": summarize_index("ndre", ndre[valid_mask]),
        "evi2": summarize_index("evi2", evi2[valid_mask]),
        "ndmi": summarize_index("ndmi", ndmi[valid_mask]),
        "bsi": summarize_index("bsi", bsi[valid_mask]),
    }

    feature_vector = {
        "ndvi": safe_mean(ndvi[valid_mask]),
        "ndre": safe_mean(ndre[valid_mask]),
        "evi2": safe_mean(evi2[valid_mask]),
        "ndmi": safe_mean(ndmi[valid_mask]),
        "bsi": safe_mean(bsi[valid_mask]),
        "contrast": contrast,
        "entropy": entropy,
        "damage_ratio": damage_ratio,
    }

    rule_result = build_rule_result(feature_vector, crop_mode)
    ml_result = build_ml_result(feature_vector, crop_mode)
    final_result = ml_result if model_mode == "ml" else rule_result
    final_meta = CLASS_META[final_result["label_key"]]

    if final_meta["is_disaster"]:
        recognized_area_mu = round(area_mu * damage_ratio, 2)
    elif final_result["label_key"] == "harvest":
        recognized_area_mu = round(area_mu * harvest_ratio, 2)
    elif final_result["label_key"] == "fallow":
        recognized_area_mu = round(area_mu * fallow_ratio, 2)
    elif final_result["label_key"] == "non_agri":
        recognized_area_mu = round(area_mu * max(non_agri_ratio, 0.15), 2)
    else:
        recognized_area_mu = 0.0

    return {
        "status": "success",
        "engine_type": engine_type,
        "image_date": image_date,
        "crop_mode": crop_mode,
        "crop_mode_label": config["label"],
        "model_mode": model_mode,
        "total_area_mu": round(area_mu, 2),
        "recognized_area_mu": recognized_area_mu,
        "damaged_area_mu": round(area_mu * damage_ratio, 2),
        "damage_ratio_float": round(damage_ratio, 6),
        "damage_ratio": f"{round(damage_ratio * 100, 1)}%",
        "thematic_layers": thematic_layers,
        "feature_vector": feature_vector_to_dict(normalize_feature_vector(feature_vector)),
        "glcm_metrics": {
            "contrast": round(contrast, 2),
            "entropy": round(entropy, 2),
        },
        "state_ratios": {
            "damage": round(damage_ratio, 4),
            "harvest": round(harvest_ratio, 4),
            "fallow": round(fallow_ratio, 4),
            "non_agri": round(non_agri_ratio, 4),
        },
        "rule_result": rule_result,
        "ml_result": ml_result,
        "final_result": {
            "label_key": final_result["label_key"],
            "label": final_result["label"],
            "confidence": final_result["confidence"],
            "explanation": final_result["explanation"],
            "top_features": final_result["top_features"],
            "is_disaster": final_meta["is_disaster"],
        },
        "spectral_data": {
            "healthy": [
                round(safe_mean(blue[valid_mask & ~damage_mask]), 4),
                round(safe_mean(green[valid_mask & ~damage_mask]), 4),
                round(safe_mean(red[valid_mask & ~damage_mask]), 4),
                round(safe_mean(nir[valid_mask & ~damage_mask]), 4),
            ],
            "damaged": [
                round(safe_mean(blue[damage_mask]), 4),
                round(safe_mean(green[damage_mask]), 4),
                round(safe_mean(red[damage_mask]), 4),
                round(safe_mean(nir[damage_mask]), 4),
            ],
        },
    }


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "time": utc_now_iso()})


@app.route("/api/samples", methods=["GET", "POST"])
def samples():
    if request.method == "GET":
        items = read_json_list(SAMPLES_FILE)
        return jsonify({"status": "success", "count": len(items), "items": items})

    payload = request.get_json(silent=True) or {}
    label_key = payload.get("label_key")
    crop_mode = payload.get("crop_mode", "wheat")
    feature_vector = payload.get("feature_vector", {})

    if label_key not in CLASS_META:
        return jsonify({"error": "样本类别无效"}), 400
    if not feature_vector:
        return jsonify({"error": "缺少样本特征"}), 400

    items = read_json_list(SAMPLES_FILE)
    sample = {
        "id": uuid.uuid4().hex[:10],
        "label_key": label_key,
        "label": CLASS_META[label_key]["label"],
        "crop_mode": crop_mode,
        "feature_vector": feature_vector,
        "geometry": payload.get("geometry"),
        "notes": payload.get("notes", ""),
        "created_at": utc_now_iso(),
    }
    items.append(sample)
    write_json_list(SAMPLES_FILE, items)
    return jsonify({"status": "success", "item": sample, "count": len(items)})


@app.route("/api/reviews", methods=["GET", "POST"])
def reviews():
    if request.method == "GET":
        items = read_json_list(REVIEWS_FILE)
        return jsonify({"status": "success", "count": len(items), "items": items})

    payload = request.get_json(silent=True) or {}
    review = {
        "id": uuid.uuid4().hex[:10],
        "case_id": payload.get("case_id", ""),
        "reviewer": payload.get("reviewer", "系统用户"),
        "corrected_label": payload.get("corrected_label", ""),
        "corrected_area_mu": payload.get("corrected_area_mu", ""),
        "comment": payload.get("comment", ""),
        "requires_resurvey": bool(payload.get("requires_resurvey", False)),
        "created_at": utc_now_iso(),
    }
    items = read_json_list(REVIEWS_FILE)
    items.append(review)
    write_json_list(REVIEWS_FILE, items)
    return jsonify({"status": "success", "item": review, "count": len(items)})


@app.route("/api/analyze", methods=["POST"])
def analyze_damage():
    payload = get_request_payload()
    area_mu = float(payload.get("area_mu", 0) or 0)
    crop_mode = payload.get("crop_mode", "wheat")
    model_mode = payload.get("model_mode", "rule")
    geojson_poly = resolve_geometry(payload.get("geometry"))

    if geojson_poly is None:
        return jsonify({"error": "未接收到空间坐标"}), 400
    if crop_mode not in CROP_CONFIGS:
        crop_mode = "wheat"
    if model_mode not in {"rule", "ml"}:
        model_mode = "rule"

    try:
        if payload["has_file"]:
            file = request.files["file"]
            engine_type = "用户提供: 无人机高分影像"
            image_date = "用户实时上传 (无人机本地数据)"
            with MemoryFile(file.read()) as memfile:
                with memfile.open() as dataset:
                    tiff_crs = dataset.crs
                    reprojected_poly = transform_geom("EPSG:4326", tiff_crs, geojson_poly)
                    out_image, _ = mask(dataset, [reprojected_poly], crop=True)
                    bands = extract_drone_bands(dataset, out_image)
        else:
            engine_type = "云端直连: Sentinel-2 真实多光谱"
            try:
                bands, image_date = fetch_stac_bands(geojson_poly)
            except Exception as exc:
                return jsonify({"error": "该区域近期无可用卫星数据，请上传无人机影像。", "details": str(exc)}), 404

        result = assemble_analysis_result(
            bands=bands,
            area_mu=area_mu,
            engine_type=engine_type,
            image_date=image_date,
            crop_mode=crop_mode,
            model_mode=model_mode,
        )
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"分析失败: {str(exc)}"}), 500


if __name__ == "__main__":
    ensure_data_files()
    app.run(host="0.0.0.0", port=5000)

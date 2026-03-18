import { readSource } from "./storage.js";

const RESOURCE_SOURCE_KEY = "agri_resources_source_v2";

const seedResources = {
  imagery: [
    { title: "Sentinel-2 \u6708\u5ea6\u5f71\u50cf", detail: "\u6700\u8fd1\u66f4\u65b0\u65f6\u95f4\uff1a2026-03-15" },
    { title: "\u65e0\u4eba\u673a\u6b63\u5c04\u56fe", detail: "\u672c\u5468\u4e0a\u4f20\uff1a16 \u4efd" },
    { title: "\u4e13\u9898\u56fe\u5c42", detail: "NDVI/NDRE/EVI2/NDMI/BSI \u5df2\u53d1\u5e03" }
  ],
  models: [
    { title: "\u6837\u672c\u5e93", detail: "\u6709\u6548\u6837\u672c 1246 \u6761\uff0c\u4eca\u65e5\u65b0\u589e 24 \u6761" },
    { title: "\u89c4\u5219\u53c2\u6570", detail: "\u7248\u672c v1.3\uff0c\u66f4\u65b0\u65f6\u95f4 2026-03-12" },
    { title: "\u6a21\u578b\u7248\u672c", detail: "\u7248\u672c ml-2026-03\uff0c\u5f85\u8bc4\u4f30" }
  ]
};

export function loadResources() {
  return readSource(RESOURCE_SOURCE_KEY, seedResources);
}


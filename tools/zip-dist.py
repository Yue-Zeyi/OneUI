#!/usr/bin/env python3
"""把 dist/site/ 打成 dist/oneui-site.zip（DEFLATE，可直接上传 EdgeOne Pages）。"""
import os
import zipfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tools/ 的上一级 = 项目根
SITE = os.path.join(HERE, "dist", "site")
OUT = os.path.join(HERE, "dist", "oneui-site.zip")

if os.path.exists(OUT):
    os.remove(OUT)

n = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _dirs, files in os.walk(SITE):
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, SITE))  # 包内路径从站点根起算
            n += 1

print("dist/oneui-site.zip  %d 个文件  %.1f KB" % (n, os.path.getsize(OUT) / 1024))

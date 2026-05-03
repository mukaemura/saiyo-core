"""
FloodFill方式：四隅から繋がっている黒っぽい領域だけを透過化する。
線画は維持される（線画は黒でも、四隅と繋がっていないため）。

引き継ぎメモの落とし穴4対策：手元の画像が拡張子.pngでも実体JPEGの場合に再変換する。
"""
from PIL import Image, ImageDraw
from collections import deque
import os
import sys

def transparentize_corners(input_path, output_path, target_size=None, threshold=60):
    """四隅から繋がっている暗領域だけ透過化"""
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    # 透過マスク用：True=透過候補、False=不透明
    transparent = [[False]*h for _ in range(w)]

    # 四隅をシードにBFS
    seeds = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
    queue = deque()

    def is_dark(x, y):
        r, g, b, _ = pixels[x, y]
        return r < threshold and g < threshold and b < threshold

    for sx, sy in seeds:
        if not transparent[sx][sy] and is_dark(sx, sy):
            transparent[sx][sy] = True
            queue.append((sx, sy))

    # BFS
    while queue:
        x, y = queue.popleft()
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not transparent[nx][ny]:
                if is_dark(nx, ny):
                    transparent[nx][ny] = True
                    queue.append((nx, ny))

    # 透過適用
    for x in range(w):
        for y in range(h):
            if transparent[x][y]:
                pixels[x, y] = (0, 0, 0, 0)

    # 縦横サイズの調整
    if target_size:
        img = img.resize(target_size, Image.LANCZOS)

    img.save(output_path, 'PNG', optimize=True)
    return img.size


# 元画像（JPEG偽装PNG）→ 透明化PNGへ
sources = [
    ('character.png',       (560, 560)),
    ('character-small.png', (240, 240)),
    ('logo.png',            (240, 240)),
    ('header-icon.png',     (120, 120)),
]

src_dir = '/mnt/user-data/uploads'
dst_dir = '/home/claude/saiyo-core/assets'
os.makedirs(dst_dir, exist_ok=True)

for fname, size in sources:
    src = os.path.join(src_dir, fname)
    dst = os.path.join(dst_dir, fname)
    if not os.path.exists(src):
        print(f"  ⚠ {fname}: 元ファイルが見つかりません: {src}")
        continue
    out_size = transparentize_corners(src, dst, target_size=size)
    file_size = os.path.getsize(dst)
    print(f"  ✅ {fname}: {out_size[0]}x{out_size[1]}, {file_size:,} bytes (RGBA透過済み)")

print("\n完了")

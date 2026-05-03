# scripts/

このフォルダには開発支援スクリプトを置く。

## transparentize.py — 画像の黒背景透過化（落とし穴4対策）

### 何の問題を解決するか

引き継ぎメモの **落とし穴4**：手元の画像が拡張子は `.png` でも、実体が JPEG（`mode=RGB`、透過なし、黒背景が焼き込まれている）状態でアップロードされてくる事象。AIツールで生成すると JPEG 偽装 PNG が来やすい。

これに気付かず本番に上げると、ログイン画面のキャラ・ロゴ周りが黒く表示される。

### 確認方法

```bash
file assets/*.png
```

期待値：
```
PNG image data, ..., 8-bit/color RGBA, non-interlaced
```

NG：
```
JPEG image data, ...
```

### 使い方

新しいキャラ画像／ロゴ画像をアップロードしてもらったら、まず file コマンドで確認。
JPEG 偽装 PNG だったら必ずこのスクリプトを通してから assets に配置する。

```bash
# 1) 元画像を /mnt/user-data/uploads/ などに置く
# 2) スクリプト内の sources 配列を編集（ファイル名と出力サイズ）
# 3) 実行
python3 scripts/transparentize.py

# 4) 出力 assets/*.png が RGBA になったか確認
file assets/*.png
```

### 仕組み

FloodFill 方式：四隅の4ピクセルをシードに BFS で「黒っぽいピクセル＋四隅と繋がっている」領域だけを透過化。線画は黒でも四隅と繋がっていないため維持される。

### 既知の限界

- 輪郭線の外側にぼかしがある画像だと、輪郭が薄くなることがある（実用上問題なし）
- threshold=60 で「黒っぽい」を判定しているので、グレー寄りの背景には効きにくい

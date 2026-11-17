# マネーウォーズ (PHP + MySQL + Docker)

DockerBase を土台にした、「マネーウォーズ(Currency Wars)」風のオートチェス。キャラ・画像・数値はオリジナル実装です。

## 起動
```
docker-compose up -d --build
docker-compose exec mysql bash -c "mysql -uroot -p'p@ssword' < /root/sql/initialize.sql"
```
`sql/initialize.sql` が必要なため、`mysql/initialize.sql` を `sql/` にもコピーしてあります。
http://localhost/ を開く。

## 遊び方
- ショップ(画面下、所持金の隣)でキャラを買うとベンチに入る。ベンチから盤面の自陣(下2行)に配置。
- キャラには「前衛(前・近接 射程1)」「後衛(後・遠距離 射程3)」がある。自陣の上の行が前列。
- 盤面のキャラは全員戦う(TFT風に移動して近づき、射程に入ると攻撃)。ベンチのキャラは戦わない。
- 絆(獣/霊/機巧/竜/財宝)は盤面にいる異なるキャラ数(2体・4体)で発動。
- 攻撃でEPが溜まると必殺技(単体大ダメージ/範囲/回復)。
- 同じキャラ3体で★アップ。装備は基本装備2つを合成して強化。
- 毎ラウンド 5G + 勝敗ボーナス1G + 利息(10Gごと+1、最大+5) + EXP+2。EXP購入でLvが上がり盤面の人数上限が増える。
- 全12ステージ(4ステージごとにボス)。ライフが0になると終了。

## 素材クレジット
ユニット画像 (`htdocs/img/u*.png`) は [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) より (ライセンス CC0 1.0)。

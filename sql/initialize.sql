SET NAMES utf8mb4;
DROP DATABASE IF EXISTS autochess;
CREATE DATABASE autochess DEFAULT CHARACTER SET utf8mb4;
USE autochess;

CREATE TABLE units (
  id INT PRIMARY KEY,
  name VARCHAR(32) NOT NULL,
  cost INT NOT NULL,
  hp INT NOT NULL,
  atk INT NOT NULL,
  spd INT NOT NULL,
  ep INT NOT NULL,
  ult VARCHAR(8) NOT NULL,
  bond1 VARCHAR(8) NOT NULL,
  bond2 VARCHAR(8) NOT NULL,
  pos VARCHAR(8) NOT NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  round_reached INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_round (round_reached)
) DEFAULT CHARSET=utf8mb4;

-- ult: burst=単体大ダメージ / aoe=範囲 / heal=周囲回復 ; pos: 前衛(射程1) / 後衛(射程3)
INSERT INTO units (id,name,cost,hp,atk,spd,ep,ult,bond1,bond2,pos) VALUES
(1,'ホーンスライム',1, 90, 9, 95,100,'heal','霊','財宝','前衛'),
(2,'コギツネ',     1, 70,12,108,100,'burst','獣','財宝','後衛'),
(3,'ポポロボ',     1, 80,10,100,120,'aoe','機巧','財宝','後衛'),
(4,'ミミズク',     2,110,14,110,110,'burst','獣','霊','後衛'),
(5,'ストームウルフ',2,120,13,104,110,'aoe','獣','竜','前衛'),
(6,'ブリキ兵',     2,150,12, 92,100,'burst','機巧','獣','前衛'),
(7,'クリスタルゴーレム',3,200,12,90,120,'heal','機巧','霊','前衛'),
(8,'シーツゴースト',3,130,17,106,100,'burst','霊','獣','後衛'),
(9,'フェニックス', 3,150,16,102,120,'aoe','竜','霊','後衛'),
(10,'クリスタルドラゴン',4,190,22,100,110,'burst','竜','機巧','前衛'),
(11,'九尾',        4,170,18,108,130,'aoe','獣','霊','後衛'),
(14,'黒騎士',      4,260,20, 94,110,'burst','機巧','竜','前衛'),
(12,'ストームドラゴン',5,240,26,106,130,'aoe','竜','霊','後衛'),
(13,'ヒドラ',      5,330,30, 98,120,'burst','竜','獣','前衛');

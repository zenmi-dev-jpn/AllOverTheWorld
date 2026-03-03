# AllOverTheWorld — ニュースツイートbot

ニュースを自動取得してTwitter(X)にツイートするPythonスクリプト。

## セットアップ

```bash
pip install -r requirements.txt
cp .env.example .env
# .env を編集してAPIキーを設定
```

## 設定 (`.env`)

| 変数名 | 説明 |
|---|---|
| `TWITTER_API_KEY` | Twitter Developer PortalのAPI Key |
| `TWITTER_API_SECRET` | API Key Secret |
| `TWITTER_ACCESS_TOKEN` | Access Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Access Token Secret |
| `NEWS_API_KEY` | [NewsAPI](https://newsapi.org) のAPIキー（任意） |
| `RSS_FEED_URL` | RSSフィードURL（デフォルト: BBC Japan） |

## 使い方

```bash
# ニュース1件をツイート
python main.py

# ニュース3件をツイート
python main.py --count 3

# 実際にツイートせず内容を確認する（テスト）
python main.py --dry-run --count 5
```

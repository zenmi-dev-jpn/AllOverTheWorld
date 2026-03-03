"""Twitterにツイートを投稿するモジュール"""

import os
import textwrap
import tweepy
from news_fetcher import NewsItem


def get_twitter_client() -> tweepy.Client:
    """Twitter API v2 クライアントを返す"""
    return tweepy.Client(
        consumer_key=os.environ["TWITTER_API_KEY"],
        consumer_secret=os.environ["TWITTER_API_SECRET"],
        access_token=os.environ["TWITTER_ACCESS_TOKEN"],
        access_token_secret=os.environ["TWITTER_ACCESS_TOKEN_SECRET"],
    )


def format_tweet(item: NewsItem) -> str:
    """ニュース記事をツイート用テキストに整形する（280文字以内）"""
    # タイトル + URL は必須
    base = f"{item.title}\n{item.url}"

    if item.source:
        base = f"【{item.source}】{base}"

    # 280文字に収まるようにタイトルを短縮
    if len(base) > 280:
        max_title_len = 280 - len(f"\n{item.url}") - (len(f"【{item.source}】") if item.source else 0) - 3
        title = textwrap.shorten(item.title, width=max_title_len, placeholder="…")
        if item.source:
            base = f"【{item.source}】{title}\n{item.url}"
        else:
            base = f"{title}\n{item.url}"

    return base


def post_tweet(client: tweepy.Client, text: str, dry_run: bool = False) -> str | None:
    """ツイートを投稿する。dry_run=True の場合は投稿せずテキストを表示する"""
    if dry_run:
        print(f"[DRY RUN] ツイート内容:\n{text}\n{'-'*40}")
        return None

    response = client.create_tweet(text=text)
    tweet_id = response.data["id"]
    print(f"ツイート投稿完了: https://twitter.com/i/web/status/{tweet_id}")
    return tweet_id

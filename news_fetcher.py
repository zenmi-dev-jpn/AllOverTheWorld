"""ニュースを取得するモジュール"""

import os
import feedparser
import requests
from dataclasses import dataclass
from typing import Optional


@dataclass
class NewsItem:
    title: str
    url: str
    summary: Optional[str] = None
    source: Optional[str] = None


def fetch_from_rss(feed_url: str, max_items: int = 5) -> list[NewsItem]:
    """RSSフィードからニュースを取得する"""
    feed = feedparser.parse(feed_url)
    items = []
    for entry in feed.entries[:max_items]:
        summary = getattr(entry, "summary", None)
        if summary:
            # HTMLタグを簡易除去
            import re
            summary = re.sub(r"<[^>]+>", "", summary).strip()
            summary = summary[:100] + "..." if len(summary) > 100 else summary

        items.append(NewsItem(
            title=entry.title,
            url=entry.link,
            summary=summary,
            source=feed.feed.get("title", "RSS"),
        ))
    return items


def fetch_from_newsapi(api_key: str, query: str = "Japan", language: str = "ja", max_items: int = 5) -> list[NewsItem]:
    """NewsAPIからニュースを取得する"""
    url = "https://newsapi.org/v2/top-headlines"
    params = {
        "apiKey": api_key,
        "q": query,
        "language": language,
        "pageSize": max_items,
    }
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    items = []
    for article in data.get("articles", []):
        description = article.get("description") or ""
        if len(description) > 100:
            description = description[:100] + "..."
        items.append(NewsItem(
            title=article["title"],
            url=article["url"],
            summary=description or None,
            source=article.get("source", {}).get("name"),
        ))
    return items


def get_news(max_items: int = 5) -> list[NewsItem]:
    """利用可能な方法でニュースを取得する"""
    news_api_key = os.getenv("NEWS_API_KEY")
    rss_url = os.getenv("RSS_FEED_URL", "https://feeds.bbci.co.uk/japanese/rss.xml")

    if news_api_key:
        try:
            return fetch_from_newsapi(news_api_key, max_items=max_items)
        except Exception as e:
            print(f"NewsAPI取得失敗: {e} — RSSにフォールバック")

    return fetch_from_rss(rss_url, max_items=max_items)

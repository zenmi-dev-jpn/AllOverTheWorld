"""ニュースを取得してTwitterにツイートするメインスクリプト"""

import argparse
import os
from dotenv import load_dotenv

from news_fetcher import get_news
from tweeter import format_tweet, get_twitter_client, post_tweet


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ニュースをTwitterにツイートする")
    parser.add_argument(
        "--count", "-n",
        type=int,
        default=1,
        help="ツイートするニュース件数 (デフォルト: 1)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際にツイートせず内容を表示するだけ",
    )
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    print(f"ニュースを {args.count} 件取得中...")
    news_items = get_news(max_items=args.count)

    if not news_items:
        print("ニュースが見つかりませんでした。")
        return

    client = None
    if not args.dry_run:
        client = get_twitter_client()

    for i, item in enumerate(news_items, 1):
        print(f"\n[{i}/{len(news_items)}] {item.title}")
        tweet_text = format_tweet(item)
        post_tweet(client, tweet_text, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

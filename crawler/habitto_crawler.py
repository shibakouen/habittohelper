#!/usr/bin/env python3
"""
Habitto Website Crawler - Extracts content for LLM training
Uses Crawl4AI to deep crawl habitto.com and output structured JSON
"""

import asyncio
import json
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class VocabularyPattern(BaseModel):
    """Recurring vocabulary or phrase patterns"""
    pattern: str
    context: str
    frequency: int = 1

class BlogSample(BaseModel):
    """Sample blog content for voice training"""
    title: str
    excerpt: str
    full_content: str
    url: str
    language: str = "en"

class ContentExample(BaseModel):
    """Example of content style"""
    type: str  # "heading", "cta", "description", etc.
    text: str
    source_url: str

class BrandVoice(BaseModel):
    """Brand voice training data"""
    tone_descriptors: list[str] = Field(default_factory=list)
    vocabulary_patterns: list[VocabularyPattern] = Field(default_factory=list)
    blog_samples: list[BlogSample] = Field(default_factory=list)
    content_style_examples: list[ContentExample] = Field(default_factory=list)
    key_messages: list[str] = Field(default_factory=list)

class CompanyInfo(BaseModel):
    """Company information"""
    name: str = "Habitto"
    description: str = ""
    founded: Optional[str] = None
    founders: list[str] = Field(default_factory=list)
    mission: str = ""
    values: list[str] = Field(default_factory=list)

class Service(BaseModel):
    """Service information"""
    name: str
    description: str
    details: list[str] = Field(default_factory=list)
    url: str = ""

class Feature(BaseModel):
    """Product feature"""
    name: str
    description: str
    category: str = ""

class PricingInfo(BaseModel):
    """Pricing information"""
    item: str
    value: str
    details: str = ""

class FAQItem(BaseModel):
    """FAQ question and answer"""
    question: str
    answer: str
    category: str = ""

class Statistic(BaseModel):
    """Company/product statistic"""
    metric: str
    value: str
    context: str = ""

class Facts(BaseModel):
    """Factual data to prevent hallucination"""
    company_info: CompanyInfo = Field(default_factory=CompanyInfo)
    services: list[Service] = Field(default_factory=list)
    features: list[Feature] = Field(default_factory=list)
    pricing: list[PricingInfo] = Field(default_factory=list)
    faq: list[FAQItem] = Field(default_factory=list)
    statistics: list[Statistic] = Field(default_factory=list)
    legal_notices: list[str] = Field(default_factory=list)

class PageContent(BaseModel):
    """Raw page content"""
    url: str
    title: str
    content: str
    page_type: str  # "home", "blog", "service", "faq", "legal", "about"
    language: str = "en"

class CrawlMetadata(BaseModel):
    """Metadata about the crawl"""
    crawl_date: str
    total_pages_crawled: int
    source_urls: list[str] = Field(default_factory=list)
    crawl_duration_seconds: float = 0.0
    errors: list[str] = Field(default_factory=list)

class HabittoTrainingData(BaseModel):
    """Root model for the complete training data"""
    brand_voice: BrandVoice = Field(default_factory=BrandVoice)
    facts: Facts = Field(default_factory=Facts)
    raw_pages: list[PageContent] = Field(default_factory=list)
    metadata: CrawlMetadata

# ============================================================================
# JAVASCRIPT FOR EXPANDING ACCORDIONS
# ============================================================================

JS_EXPAND_ALL = """
(async () => {
    // Expand all accordion elements
    const accordionSelectors = [
        '[data-accordion]',
        '.accordion',
        '.accordion-trigger',
        '.accordion-button',
        '.collapse-trigger',
        '.faq-question',
        '.faq-item',
        'details summary',
        '[aria-expanded="false"]',
        '.expandable',
        '.toggle-button',
        'button[data-toggle]',
        '.disclosure'
    ];

    for (const selector of accordionSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            try {
                el.click();
                await new Promise(r => setTimeout(r, 200));
            } catch (e) {}
        }
    }

    // Open all <details> elements
    document.querySelectorAll('details').forEach(d => d.open = true);

    // Click "show more" / "read more" buttons (English and Japanese)
    const morePatterns = /more|expand|show|read more|view all|see all|詳細|もっと見る|続きを読む|表示/i;
    document.querySelectorAll('button, a, span[role="button"]').forEach(el => {
        if (el.textContent && morePatterns.test(el.textContent)) {
            try {
                el.click();
            } catch (e) {}
        }
    });

    // Wait for animations to complete
    await new Promise(r => setTimeout(r, 1000));

    // Scroll to load any lazy content
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 500));
    window.scrollTo(0, 0);
})();
"""

# ============================================================================
# CONTENT EXTRACTION HELPERS
# ============================================================================

def categorize_page(url: str) -> str:
    """Determine page type from URL"""
    url_lower = url.lower()

    if any(p in url_lower for p in ['/blog', '/news', '/article', '/post']):
        return "blog"
    elif any(p in url_lower for p in ['/faq', '/help', '/support', '/qa']):
        return "faq"
    elif any(p in url_lower for p in ['/about', '/company', '/team', '/story']):
        return "about"
    elif any(p in url_lower for p in ['/terms', '/privacy', '/legal', '/policy']):
        return "legal"
    elif any(p in url_lower for p in ['/service', '/feature', '/product', '/offer']):
        return "service"
    elif any(p in url_lower for p in ['/pricing', '/plan', '/fee']):
        return "pricing"
    elif url_lower.endswith('/') or url_lower.endswith('.com') or '/en' in url_lower or '/ja' in url_lower:
        return "home"
    else:
        return "other"

def detect_language(url: str, content: str) -> str:
    """Detect content language"""
    if '/ja' in url or '/jp' in url:
        return "ja"
    if '/en' in url:
        return "en"
    # Check for Japanese characters
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]', content[:500] if content else ""):
        return "ja"
    return "en"

def extract_statistics(content: str) -> list[Statistic]:
    """Extract statistics/numbers from content"""
    stats = []

    # Patterns for common statistics
    patterns = [
        (r'(\d[\d,\.]+)\s*(?:users?|customers?|clients?)', 'users'),
        (r'(\d[\d,\.]+)\s*(?:installs?|downloads?)', 'installs'),
        (r'(\d[\d,\.]+)%?\s*(?:interest|rate|APY|yield)', 'interest_rate'),
        (r'(?:¥|JPY)\s*(\d[\d,\.]+)', 'currency_jpy'),
        (r'(?:\$|USD)\s*(\d[\d,\.]+)', 'currency_usd'),
        (r'(\d{4})\s*(?:founded|established|since)', 'founded'),
    ]

    for pattern, metric_type in patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            stats.append(Statistic(
                metric=metric_type,
                value=match,
                context=f"Extracted from content"
            ))

    return stats

def extract_faq_items(content: str, url: str) -> list[FAQItem]:
    """Extract FAQ-style Q&A from content"""
    faq_items = []

    # Common Q&A patterns
    qa_patterns = [
        r'(?:Q|Question|Q\.)\s*[:：]?\s*(.+?)\s*(?:A|Answer|A\.)\s*[:：]?\s*(.+?)(?=(?:Q|Question|Q\.)|$)',
        r'(?:###?\s*)?(.+\?)\s*\n+(.+?)(?=(?:###?\s*)?[^\n]+\?|\Z)',
    ]

    for pattern in qa_patterns:
        matches = re.findall(pattern, content, re.MULTILINE | re.DOTALL)
        for q, a in matches[:20]:  # Limit to 20 items
            q = q.strip()[:500]
            a = a.strip()[:2000]
            if len(q) > 10 and len(a) > 20:
                faq_items.append(FAQItem(
                    question=q,
                    answer=a,
                    category=categorize_page(url)
                ))

    return faq_items

def extract_brand_elements(content: str, url: str) -> dict:
    """Extract brand voice elements from content"""
    elements = {
        'tone_words': [],
        'key_phrases': [],
        'ctas': []
    }

    # Look for call-to-action phrases
    cta_patterns = [
        r'((?:start|begin|get started|sign up|join|download|try)[^.!?]*[.!?])',
        r'((?:開始|始める|登録|ダウンロード)[^。！？]*[。！？])',
    ]

    for pattern in cta_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        elements['ctas'].extend(matches[:10])

    # Extract headings as key messages
    heading_pattern = r'^#{1,3}\s+(.+)$'
    headings = re.findall(heading_pattern, content, re.MULTILINE)
    elements['key_phrases'].extend(headings[:20])

    return elements

# ============================================================================
# MAIN CRAWLER
# ============================================================================

async def crawl_habitto():
    """Main crawling function"""
    print("=" * 60)
    print("HABITTO WEBSITE CRAWLER")
    print("=" * 60)

    start_time = datetime.now()

    # Initialize result structure
    training_data = HabittoTrainingData(
        metadata=CrawlMetadata(
            crawl_date=start_time.isoformat(),
            total_pages_crawled=0,
            source_urls=[],
            crawl_duration_seconds=0.0,
            errors=[]
        )
    )

    # Known Habitto facts (from research)
    training_data.facts.company_info = CompanyInfo(
        name="Habitto",
        description="Japan's first fintech savings app offering high-interest accounts",
        founded="2021",
        founders=["Samantha Ghiotti", "Liam McCance"],
        mission="Make saving money simple and rewarding for everyone in Japan",
        values=["Transparency", "Simplicity", "Customer-first"]
    )

    training_data.facts.statistics = [
        Statistic(metric="interest_rate", value="0.3%", context="Annual interest rate on savings"),
        Statistic(metric="app_installs", value="42,000+", context="Total app installations"),
        Statistic(metric="deposits", value="JPY 4.7 billion", context="Total deposits from users"),
    ]

    # URLs to crawl
    urls_to_crawl = [
        "https://www.habitto.com/",
        "https://www.habitto.com/en",
        "https://www.habitto.com/ja",
    ]

    crawled_urls = set()
    all_pages = []

    config = CrawlerRunConfig(
        js_code=JS_EXPAND_ALL,
        wait_for="body",
        delay_before_return_html=2.0,
        cache_mode=CacheMode.BYPASS,
        page_timeout=60000,
        verbose=True
    )

    async with AsyncWebCrawler() as crawler:
        # First pass: crawl main pages and discover links
        print("\n[Phase 1] Crawling main pages...")

        for url in urls_to_crawl:
            if url in crawled_urls:
                continue

            # Skip non-content URLs (PDFs, images, etc.)
            if any(skip in url.lower() for skip in ['#', 'mailto:', 'tel:', '.pdf', '.jpg', '.png', '.gif', '.svg', 'javascript:']):
                continue

            print(f"\n  Crawling: {url}")

            try:
                result = await crawler.arun(url=url, config=config)

                if result.success:
                    crawled_urls.add(url)

                    # Extract page content
                    page_type = categorize_page(url)
                    language = detect_language(url, result.markdown or "")

                    page = PageContent(
                        url=url,
                        title=result.metadata.get('title', '') if result.metadata else '',
                        content=result.markdown or result.cleaned_html or "",
                        page_type=page_type,
                        language=language
                    )
                    all_pages.append(page)

                    # Collect internal links for phase 2
                    if result.links:
                        for link in result.links.get('internal', []):
                            link_url = link.get('href', '') if isinstance(link, dict) else str(link)
                            if link_url and 'habitto.com' in link_url and link_url not in crawled_urls:
                                urls_to_crawl.append(link_url)

                    print(f"    ✓ Success - {page_type} ({language})")
                else:
                    print(f"    ✗ Failed: {result.error_message}")
                    training_data.metadata.errors.append(f"{url}: {result.error_message}")

            except Exception as e:
                print(f"    ✗ Error: {str(e)}")
                training_data.metadata.errors.append(f"{url}: {str(e)}")

            # Rate limiting
            await asyncio.sleep(2)

        # Phase 2: Crawl discovered pages
        print("\n[Phase 2] Crawling discovered pages...")

        additional_urls = [u for u in urls_to_crawl if u not in crawled_urls][:50]  # Limit to 50 additional pages

        for url in additional_urls:
            if url in crawled_urls:
                continue

            # Skip non-content URLs
            if any(skip in url.lower() for skip in ['#', 'mailto:', 'tel:', '.pdf', '.jpg', '.png', 'javascript:']):
                continue

            print(f"\n  Crawling: {url}")

            try:
                result = await crawler.arun(url=url, config=config)

                if result.success:
                    crawled_urls.add(url)

                    page_type = categorize_page(url)
                    language = detect_language(url, result.markdown or "")

                    page = PageContent(
                        url=url,
                        title=result.metadata.get('title', '') if result.metadata else '',
                        content=result.markdown or result.cleaned_html or "",
                        page_type=page_type,
                        language=language
                    )
                    all_pages.append(page)
                    print(f"    ✓ Success - {page_type} ({language})")
                else:
                    print(f"    ✗ Failed: {result.error_message}")

            except Exception as e:
                print(f"    ✗ Error: {str(e)}")

            await asyncio.sleep(2)

    # Process collected pages
    print("\n[Phase 3] Processing content...")

    training_data.raw_pages = all_pages
    training_data.metadata.source_urls = list(crawled_urls)
    training_data.metadata.total_pages_crawled = len(all_pages)

    # Extract brand voice elements
    for page in all_pages:
        if page.page_type == "blog":
            training_data.brand_voice.blog_samples.append(BlogSample(
                title=page.title,
                excerpt=page.content[:500] if page.content else "",
                full_content=page.content,
                url=page.url,
                language=page.language
            ))

        # Extract CTAs and style examples
        brand_elements = extract_brand_elements(page.content, page.url)
        for cta in brand_elements['ctas']:
            training_data.brand_voice.content_style_examples.append(ContentExample(
                type="cta",
                text=cta,
                source_url=page.url
            ))
        for phrase in brand_elements['key_phrases']:
            training_data.brand_voice.key_messages.append(phrase)

        # Extract FAQs
        if page.page_type in ["faq", "home", "service"]:
            faq_items = extract_faq_items(page.content, page.url)
            training_data.facts.faq.extend(faq_items)

        # Extract statistics
        stats = extract_statistics(page.content)
        for stat in stats:
            # Avoid duplicates
            if not any(s.value == stat.value for s in training_data.facts.statistics):
                training_data.facts.statistics.append(stat)

    # Deduplicate key messages
    training_data.brand_voice.key_messages = list(set(training_data.brand_voice.key_messages))[:50]

    # Add tone descriptors based on analysis
    training_data.brand_voice.tone_descriptors = [
        "friendly",
        "approachable",
        "professional",
        "clear",
        "trustworthy",
        "modern",
        "helpful",
        "encouraging"
    ]

    # Calculate duration
    end_time = datetime.now()
    training_data.metadata.crawl_duration_seconds = (end_time - start_time).total_seconds()

    # Save to JSON
    output_path = "/Users/matteo/habittohelper/crawler/habitto_training_data.json"

    print(f"\n[Phase 4] Saving to {output_path}...")

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(training_data.model_dump(), f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print("CRAWL COMPLETE")
    print("=" * 60)
    print(f"Pages crawled: {training_data.metadata.total_pages_crawled}")
    print(f"Duration: {training_data.metadata.crawl_duration_seconds:.1f} seconds")
    print(f"Blog samples: {len(training_data.brand_voice.blog_samples)}")
    print(f"FAQ items: {len(training_data.facts.faq)}")
    print(f"Statistics: {len(training_data.facts.statistics)}")
    print(f"Errors: {len(training_data.metadata.errors)}")
    print(f"\nOutput saved to: {output_path}")

    return training_data

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    result = asyncio.run(crawl_habitto())

# PRD: Habitto Website Crawler for LLM Training Data

## Project Overview

### Title
Habitto Knowledge Extraction System - Web Crawler to JSON Training Data

### Summary
Build a Python-based web crawler using Crawl4AI to systematically extract all content from habitto.com, producing a structured JSON file that serves dual purposes: (1) training an LLM to write in Habitto's authentic brand voice, and (2) providing a factual source of truth to prevent hallucination when generating content about Habitto's services.

### Problem Statement
An LLM writing blog posts for Habitto needs:
- **Voice/Style Training**: Examples of Habitto's writing patterns, vocabulary, tone, and content structure
- **Factual Grounding**: Immutable facts about services, features, pricing, and company information that the LLM must never contradict or hallucinate

Without a comprehensive knowledge base, the LLM will generate generic content that doesn't match Habitto's voice and may contain factual errors about their fintech services.

### Solution
Crawl the entirety of habitto.com using Crawl4AI with:
- Deep crawling (BFS) to discover all pages
- JavaScript interaction to expand collapsible menus/accordions
- Bilingual content extraction (Japanese/English)
- Structured JSON output optimized for LLM consumption

### Success Criteria
- [ ] All public pages on habitto.com are crawled (estimated 50-200 pages)
- [ ] Collapsible/accordion content is fully expanded and captured
- [ ] Both Japanese and English content variants are extracted
- [ ] JSON output is valid and parseable
- [ ] JSON structure separates "brand_voice" from "facts"
- [ ] All factual data (services, features, pricing) is accurately captured
- [ ] Script completes without errors and respects rate limits

### Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.11+ |
| Web Crawler | Crawl4AI | Latest (pip install -U crawl4ai) |
| Browser Engine | Playwright (via Crawl4AI) | Auto-installed |
| JSON Validation | pydantic | 2.5+ |
| Testing | pytest + pytest-asyncio | 8.0+ |

---

## Architecture & Setup Phase

### Task 1: Project Scaffolding

**Description**: Create the project directory structure and initialize the Python environment with all required dependencies.

**Acceptance Criteria**:
- [ ] Directory structure created as specified below
- [ ] Virtual environment activated
- [ ] All dependencies installed with exact versions
- [ ] Crawl4AI browser engine initialized (`crawl4ai-setup`)
- [ ] `crawl4ai-doctor` runs successfully

**Directory Structure**:
```
habitto_crawler/
├── src/
│   ├── __init__.py
│   ├── crawler.py          # Main crawler logic
│   ├── extractors.py       # Content extraction strategies
│   ├── schemas.py          # Pydantic schemas for output
│   ├── js_interactions.py  # JavaScript code for expanding menus
│   └── utils.py            # Helper functions
├── tests/
│   ├── __init__.py
│   ├── test_crawler.py
│   ├── test_extractors.py
│   ├── test_schemas.py
│   └── fixtures/
│       └── sample_pages/   # Sample HTML for testing
├── output/
│   └── .gitkeep
├── requirements.txt
├── pyproject.toml
├── pytest.ini
└── README.md
```

**Test Requirements**:
- [ ] `pytest --collect-only` shows test discovery working
- [ ] Import all modules without errors

```json
{
  "task_id": "TASK-1",
  "name": "Project Scaffolding",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": [],
  "estimated_complexity": "low"
}
```

### Task 2: Dependencies Installation

**Description**: Create requirements.txt and install all dependencies with pinned versions.

**Acceptance Criteria**:
- [ ] requirements.txt created with all dependencies
- [ ] All packages install successfully
- [ ] Crawl4AI browser setup completes

**requirements.txt**:
```
crawl4ai>=0.4.0
pydantic>=2.5.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
python-dotenv>=1.0.0
aiofiles>=23.2.0
```

**Test Requirements**:
- [ ] `pip check` shows no dependency conflicts
- [ ] `python -c "from crawl4ai import AsyncWebCrawler"` succeeds

```json
{
  "task_id": "TASK-2",
  "name": "Dependencies Installation",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-1"],
  "estimated_complexity": "low"
}
```

---

## Testing Architecture

### Testing Frameworks
- **pytest**: Primary test runner
- **pytest-asyncio**: Async test support for Crawl4AI
- **unittest.mock**: Mocking HTTP responses

### Test Structure
```
tests/
├── conftest.py              # Shared fixtures
├── test_crawler.py          # Crawler logic tests
├── test_extractors.py       # Content extraction tests
├── test_schemas.py          # Schema validation tests
├── test_js_interactions.py  # JavaScript code tests
└── fixtures/
    └── sample_pages/
        ├── homepage.html
        ├── services_page.html
        └── faq_accordion.html
```

### pytest.ini Configuration
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short
```

### Coverage Requirements
- Minimum 80% code coverage
- 100% coverage on schema validation
- All edge cases for accordion expansion tested

---

## Feature Tasks

### Task 3: Define Output JSON Schema

**Description**: Create Pydantic models that define the exact structure of the output JSON file, separating brand voice training data from factual content.

**Acceptance Criteria**:
- [ ] `HabittoTrainingData` root model defined
- [ ] `BrandVoice` model with tone, vocabulary, blog samples
- [ ] `Facts` model with services, features, company info
- [ ] `Metadata` model with crawl statistics
- [ ] All models export to JSON schema
- [ ] Schema handles Japanese/English content

**Schema Structure**:
```python
class HabittoTrainingData(BaseModel):
    brand_voice: BrandVoice
    facts: Facts
    metadata: CrawlMetadata

class BrandVoice(BaseModel):
    tone_descriptors: list[str]
    vocabulary_patterns: list[VocabularyPattern]
    blog_samples: list[BlogSample]
    content_style_examples: list[ContentExample]
    language_variants: dict[str, LanguageContent]  # "en", "ja"

class Facts(BaseModel):
    company_info: CompanyInfo
    services: list[Service]
    features: list[Feature]
    pricing: list[PricingInfo]
    faq: list[FAQItem]
    legal_compliance: list[LegalInfo]
    statistics: list[Statistic]  # e.g., "42,000+ app installs"

class CrawlMetadata(BaseModel):
    crawl_date: datetime
    total_pages_crawled: int
    source_urls: list[str]
    crawl_duration_seconds: float
```

**Test Requirements**:
- [ ] Unit tests for each model's validation
- [ ] Edge cases: empty lists, missing optional fields
- [ ] JSON serialization/deserialization round-trip
- [ ] Japanese character handling (UTF-8)

```json
{
  "task_id": "TASK-3",
  "name": "Define Output JSON Schema",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-2"],
  "estimated_complexity": "medium"
}
```

### Task 4: JavaScript Interaction Scripts

**Description**: Create JavaScript code snippets that expand all collapsible menus, accordions, FAQ dropdowns, and hidden content sections before content extraction.

**Acceptance Criteria**:
- [ ] Script expands all accordion elements
- [ ] Script clicks all "show more" / "read more" buttons
- [ ] Script expands FAQ dropdowns
- [ ] Script waits for content to load after each expansion
- [ ] Works with both Japanese and English versions

**JavaScript Patterns to Handle**:
```javascript
// Accordion expansion (common patterns)
document.querySelectorAll('[data-accordion], .accordion, .collapse-trigger, .faq-question, details summary').forEach(el => el.click());

// Wait for animations
await new Promise(r => setTimeout(r, 500));

// Expand "show more" buttons
document.querySelectorAll('button, a').forEach(el => {
    if (el.textContent.match(/more|expand|show|詳細|もっと見る/i)) {
        el.click();
    }
});
```

**Test Requirements**:
- [ ] Unit tests with mock DOM elements
- [ ] Test accordion expansion logic
- [ ] Test wait timing behavior
- [ ] Test Japanese text pattern matching

```json
{
  "task_id": "TASK-4",
  "name": "JavaScript Interaction Scripts",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-2"],
  "estimated_complexity": "medium"
}
```

### Task 5: Content Extractors

**Description**: Build extraction functions that categorize crawled content into brand voice elements vs factual data.

**Acceptance Criteria**:
- [ ] `extract_brand_voice()` identifies tone, vocabulary, style
- [ ] `extract_facts()` pulls services, features, pricing, FAQ
- [ ] `categorize_page()` determines page type (blog, service, FAQ, legal)
- [ ] Handles both Markdown and HTML input
- [ ] Preserves structure (headings, lists, tables)

**Page Categories**:
| Category | URL Patterns | Content Type |
|----------|--------------|--------------|
| Blog | `/blogs/*`, `/news/*` | Brand voice samples |
| Services | `/services/*`, `/features/*` | Factual - services |
| FAQ | `/faq/*`, `/help/*` | Factual - Q&A |
| About | `/about/*`, `/company/*` | Factual - company info |
| Legal | `/terms/*`, `/privacy/*`, `/legal/*` | Factual - compliance |
| Home | `/`, `/en`, `/ja` | Mixed - both |

**Test Requirements**:
- [ ] Unit tests for each extractor function
- [ ] Test with sample Habitto-style content
- [ ] Edge cases: empty content, malformed HTML
- [ ] Japanese content extraction

```json
{
  "task_id": "TASK-5",
  "name": "Content Extractors",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-3"],
  "estimated_complexity": "high"
}
```

### Task 6: Deep Crawler Implementation

**Description**: Implement the main crawler using Crawl4AI's BFS deep crawling strategy to discover and crawl all pages on habitto.com.

**Acceptance Criteria**:
- [ ] Uses `BFSDeepCrawlStrategy` for comprehensive coverage
- [ ] Respects rate limits (1-2 second delay between requests)
- [ ] Stays within habitto.com domain (no external links)
- [ ] Handles both `/en` and `/ja` language paths
- [ ] Integrates JavaScript expansion before extraction
- [ ] Captures all discovered URLs
- [ ] Handles crawl failures gracefully with retries

**Crawler Configuration**:
```python
config = CrawlerRunConfig(
    deep_crawl_strategy=BFSDeepCrawlStrategy(
        max_depth=5,              # Go deep into site structure
        include_external=False,   # Stay on habitto.com only
        max_pages=500             # Upper limit safety
    ),
    js_code=[JS_EXPAND_ALL],      # Expand accordions
    wait_for="css:.content-loaded",
    cache_mode=CacheMode.BYPASS,
    delay_between_requests=1.5    # Rate limiting
)
```

**Test Requirements**:
- [ ] Unit test crawler configuration
- [ ] Mock test for single page crawl
- [ ] Integration test with local HTML fixtures
- [ ] Test retry logic on failures

```json
{
  "task_id": "TASK-6",
  "name": "Deep Crawler Implementation",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-4", "TASK-5"],
  "estimated_complexity": "high"
}
```

### Task 7: Content Aggregation & Deduplication

**Description**: Aggregate all crawled content, remove duplicates, and organize into the final schema structure.

**Acceptance Criteria**:
- [ ] Merge content from all crawled pages
- [ ] Deduplicate identical content across pages
- [ ] Aggregate FAQ items into single list
- [ ] Combine service descriptions
- [ ] Preserve source URL for each piece of content
- [ ] Handle language variant merging

**Test Requirements**:
- [ ] Unit test deduplication logic
- [ ] Test merging of partial data
- [ ] Edge case: conflicting information across pages

```json
{
  "task_id": "TASK-7",
  "name": "Content Aggregation & Deduplication",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-5", "TASK-6"],
  "estimated_complexity": "medium"
}
```

### Task 8: JSON Output Generation

**Description**: Generate the final JSON file with all extracted content, validated against the schema.

**Acceptance Criteria**:
- [ ] JSON file is valid and parseable
- [ ] All required schema fields are populated
- [ ] File is UTF-8 encoded (Japanese support)
- [ ] File size is reasonable (< 50MB)
- [ ] Includes crawl metadata
- [ ] Output saved to `output/habitto_training_data.json`

**Test Requirements**:
- [ ] Unit test JSON generation
- [ ] Validate output against schema
- [ ] Test file writing and encoding

```json
{
  "task_id": "TASK-8",
  "name": "JSON Output Generation",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-7"],
  "estimated_complexity": "low"
}
```

### Task 9: Main Entry Point & CLI

**Description**: Create the main script entry point with command-line options for running the crawler.

**Acceptance Criteria**:
- [ ] `python -m habitto_crawler` runs the full crawl
- [ ] `--output` flag to specify output file path
- [ ] `--max-pages` flag to limit crawl scope (for testing)
- [ ] `--verbose` flag for detailed logging
- [ ] Progress reporting during crawl
- [ ] Graceful error handling and reporting

**Test Requirements**:
- [ ] Unit test CLI argument parsing
- [ ] Integration test full workflow with limited pages

```json
{
  "task_id": "TASK-9",
  "name": "Main Entry Point & CLI",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-8"],
  "estimated_complexity": "low"
}
```

### Task 10: Full Integration Test & Validation

**Description**: Run the complete crawler on habitto.com and validate the output.

**Acceptance Criteria**:
- [ ] Full crawl completes without errors
- [ ] Output JSON is valid
- [ ] All major page sections captured
- [ ] Collapsible content is present in output
- [ ] Both Japanese and English content included
- [ ] Factual data is accurate (spot-check)
- [ ] Brand voice samples are representative

**Validation Checklist**:
- [ ] Homepage content captured
- [ ] Services/features pages captured
- [ ] Blog posts captured
- [ ] FAQ content (expanded) captured
- [ ] Legal/terms pages captured
- [ ] About/company info captured

```json
{
  "task_id": "TASK-10",
  "name": "Full Integration Test & Validation",
  "status": "pending",
  "tests_status": "not_written",
  "unit_tests_passing": false,
  "integration_tests_passing": false,
  "dependencies": ["TASK-9"],
  "estimated_complexity": "medium"
}
```

---

## Instructions for AI Coding Agent

### Development Methodology
You MUST follow **Test-Driven Development (TDD)** and **Spec-Driven Development (SDD)**:

1. **Read the spec first** - Understand the full requirement before writing code
2. **Write tests first** - Create failing tests that define expected behavior
3. **Implement minimally** - Write only enough code to pass tests
4. **Refactor** - Clean up while keeping tests green
5. **Update this document** - Mark checkboxes and update JSON blocks

### Web Search & Documentation Protocol
- Use Context7 MCP to get Crawl4AI documentation
- Always verify API signatures against latest docs
- Search for known issues/bugs before implementing workarounds
- Check Crawl4AI GitHub issues for edge cases

### Test Execution Protocol
After completing each task:
1. Run the current task's unit tests
2. Run the previous 2 tasks' unit tests (regression check)
3. Run all integration tests that touch modified code
4. Only mark task complete if ALL tests pass

```bash
# Run single task tests
pytest tests/test_<module>.py -v

# Run all tests
pytest tests/ -v --cov=src --cov-report=term-missing
```

### Document Update Protocol
When a task is complete:
1. Check off all acceptance criteria boxes
2. Update the JSON block:
   - Set `"status": "completed"`
   - Set `"tests_status": "passing"`
   - Set `"unit_tests_passing": true`
   - Set `"integration_tests_passing": true`
3. Add completion timestamp as comment

### Error Handling Standards
- Never silently swallow errors
- Log all HTTP errors with URL and status code
- Retry failed requests up to 3 times with exponential backoff
- Save partial results on fatal errors
- Provide actionable error messages

### Code Quality Standards
- Follow PEP 8 for Python code
- Use type hints on all functions
- Keep functions small and focused (< 30 lines)
- Use meaningful variable/function names
- No hardcoded values - use configuration
- All async code uses `async/await` properly

### Rate Limiting & Ethics
- Minimum 1.5 second delay between requests
- Respect robots.txt (Crawl4AI handles this)
- Maximum 500 pages total (safety limit)
- Stop on repeated 429 (rate limit) responses

---

## Project State (External Memory)

### Completed Tasks
<!-- Agent: Add completed task IDs here -->

### Current Task
<!-- Agent: Update with current task ID -->

### Blockers & Notes
<!-- Agent: Document any blockers or important discoveries -->

### Test Results Log
<!-- Agent: Log test run results with timestamps -->

---

## Dependency Graph

```
TASK-1 (Scaffolding)
    └── TASK-2 (Dependencies)
            ├── TASK-3 (Schema) ─────────────────┐
            └── TASK-4 (JS Interactions) ────────┤
                                                 ├── TASK-6 (Crawler)
                    TASK-3 ── TASK-5 (Extractors)┘        │
                                      │                   │
                                      └───────────────────┴── TASK-7 (Aggregation)
                                                                      │
                                                              TASK-8 (JSON Output)
                                                                      │
                                                              TASK-9 (CLI)
                                                                      │
                                                              TASK-10 (Integration)
```

### Execution Order
1. TASK-1 → TASK-2 (Setup)
2. TASK-3, TASK-4 (Parallel - Schema + JS)
3. TASK-5 (Extractors, depends on TASK-3)
4. TASK-6 (Crawler, depends on TASK-4 + TASK-5)
5. TASK-7 (Aggregation)
6. TASK-8 (JSON Output)
7. TASK-9 (CLI)
8. TASK-10 (Integration Test)

---

## Expected Output JSON Structure

```json
{
  "brand_voice": {
    "tone_descriptors": [
      "friendly",
      "approachable",
      "trustworthy",
      "educational",
      "encouraging"
    ],
    "vocabulary_patterns": [
      {
        "term": "money habits",
        "usage": "Core brand term - always use this phrase",
        "examples": ["build good money habits", "develop healthy money habits"]
      },
      {
        "term": "financial anxiety",
        "usage": "Problem statement - target audience pain point",
        "examples": ["tackle financial anxiety", "overcome financial anxiety"]
      }
    ],
    "blog_samples": [
      {
        "title": "Sample Blog Title",
        "url": "https://habitto.com/blogs/...",
        "content_markdown": "...",
        "word_count": 850,
        "language": "en"
      }
    ],
    "content_style_examples": [
      {
        "type": "headline",
        "examples": ["...", "..."]
      },
      {
        "type": "cta",
        "examples": ["...", "..."]
      }
    ],
    "language_variants": {
      "en": {
        "common_phrases": ["..."],
        "tone_notes": "..."
      },
      "ja": {
        "common_phrases": ["..."],
        "tone_notes": "..."
      }
    }
  },
  "facts": {
    "company_info": {
      "name": "Habitto",
      "legal_name": "SJML Japan K.K.",
      "founded": "2021",
      "headquarters": "Japan",
      "founders": [
        {"name": "Samantha Ghiotti", "role": "CEO", "nationality": "Italian"},
        {"name": "Liam McCance", "role": "Co-founder", "nationality": "Australian"}
      ],
      "mission": "Help young generation build good money habits",
      "tagline": "Japan's first digital bank offering financial advice"
    },
    "services": [
      {
        "name": "Savings Account",
        "description": "Market-leading yield savings account",
        "key_features": ["0.3% interest rate", "Higher than traditional banks"],
        "source_url": "..."
      },
      {
        "name": "Debit Card",
        "description": "...",
        "key_features": ["..."],
        "source_url": "..."
      },
      {
        "name": "Investment Products",
        "description": "...",
        "key_features": ["..."],
        "source_url": "..."
      },
      {
        "name": "Financial Advisory",
        "description": "Free financial planning with digital advisors",
        "key_features": [
          "Video consultations",
          "Chat support",
          "NISA guidance",
          "Personalized advice"
        ],
        "source_url": "..."
      },
      {
        "name": "Insurance",
        "description": "...",
        "key_features": ["..."],
        "source_url": "..."
      }
    ],
    "features": [
      {
        "name": "Single App Integration",
        "description": "Savings, insurance, and investment in one app",
        "source_url": "..."
      }
    ],
    "pricing": [
      {
        "item": "Financial Advisory",
        "price": "Free",
        "notes": "Complimentary with account"
      },
      {
        "item": "Savings Interest Rate",
        "price": "0.3%",
        "notes": "Higher than traditional Japanese banks"
      }
    ],
    "faq": [
      {
        "question": "...",
        "answer": "...",
        "category": "Getting Started",
        "source_url": "..."
      }
    ],
    "legal_compliance": [
      {
        "license": "Deposit-taking intermediary",
        "description": "First company in Japan to register",
        "source_url": "..."
      },
      {
        "license": "Electronic financial services intermediary",
        "description": "...",
        "source_url": "..."
      },
      {
        "license": "Securities intermediary",
        "description": "Registered October 2022",
        "source_url": "..."
      }
    ],
    "statistics": [
      {
        "metric": "App installs",
        "value": "42,000+",
        "as_of": "2024",
        "source_url": "..."
      },
      {
        "metric": "Total deposits",
        "value": "JPY 4.7 billion+",
        "as_of": "2024",
        "source_url": "..."
      },
      {
        "metric": "Total funding",
        "value": "US$19 million",
        "as_of": "2024",
        "source_url": "..."
      }
    ]
  },
  "metadata": {
    "crawl_date": "2025-01-03T12:00:00Z",
    "total_pages_crawled": 87,
    "source_urls": [
      "https://www.habitto.com/",
      "https://www.habitto.com/en/",
      "https://www.habitto.com/ja/",
      "..."
    ],
    "crawl_duration_seconds": 245.3,
    "crawler_version": "crawl4ai-0.4.x",
    "errors": []
  }
}
```

---

## LLM Usage Instructions (For Consumer of this JSON)

When using this JSON to train/prompt an LLM:

```
## System Prompt Structure

You are a blog writer for Habitto, Japan's first digital bank offering financial advice.

### FACTUAL GROUNDING (MANDATORY - NEVER CONTRADICT)
Use the following facts as immutable ground truth. NEVER deviate from these facts.
NEVER make up information not present in this data.

{Insert facts section from JSON}

### BRAND VOICE (STYLE GUIDANCE)
Match the following voice characteristics:
- Tone: {tone_descriptors}
- Vocabulary: Always use terms like "money habits", "financial anxiety"
- Style: {content_style_examples}

Reference these blog samples for voice matching:
{Insert blog_samples}

### WRITING RULES
1. If asked about a service/feature, ONLY use information from the "facts" section
2. If the information isn't in "facts", respond with "I don't have information about that"
3. Match the tone and vocabulary patterns from "brand_voice"
4. Use the same headline/CTA styles as shown in examples
```

---

## Quality Checklist

Before marking this PRD complete:
- [x] Architecture/setup tasks come FIRST
- [x] Testing infrastructure established BEFORE features
- [x] Every feature has explicit test requirements
- [x] JSON blocks are valid and parseable
- [x] Dependencies between tasks are clearly defined
- [x] Edge cases enumerated for each feature
- [x] Agent instructions are clear and actionable
- [x] Web search recommendations specific to tech stack
- [x] Output JSON structure fully documented
- [x] LLM usage instructions included

---

## References

- [Crawl4AI Documentation](https://github.com/unclecode/crawl4ai)
- [Habitto Official Site](https://www.habitto.com/)
- [Habitto LinkedIn](https://www.linkedin.com/company/habittojp/)
- [Habitto Funding News](https://cherubic.com/blog/founder-interview-habitto/)

# SHUFURI
SHUFURI — Turn external-AI lyric output into beautiful, paginated study posters. Ruby/pinyin layout for JP &amp; Chinese, multi-language typography (KO/EN), vocab &amp; grammar notes, ink-style editing, study cards, PDF/PNG export. Local-only. Vite + React + Capacitor iOS.
SHUFURI is a local-first lyric typography and digital binder for language learners—not a lyrics search engine or built-in AI chatbot.

Workflow: Generate a structured prompt → paste results from ChatGPT, Kimi, Doubao, or similar → SHUFURI parses the stream, lays out ruby / pinyin, translations, vocab & grammar blocks, and paginates them into print-ready posters.

Highlights

Multi-language pipelines: Japanese (furigana), Korean, English, Chinese (pinyin)
Poster layouts: B5 print, phone portrait, 1:1 square; smart pagination with overflow repair
Ink fine-tuning: Double-tap to edit ruby, Chinese lines, and titles on the canvas
Study cards: Extract vocab/grammar into a local library; export to Anki
Export: PDF and PNG; native iOS shell with deep links to AI apps
Privacy: Projects stored in IndexedDB on device; no cloud sync, no bundled copyrighted lyrics
Stack: Vite, React, Capacitor (iOS), IndexedDB.


import sys
from pathlib import Path
from pypdf import PdfReader

pdfs = [
    r"C:\Users\Lenovo\Downloads\stockconnect-channelengine-replacement-roadmap.pdf",
    r"C:\Users\Lenovo\Downloads\StockConnect-Replace-ChannelEngine-Roadmap-Presentation.pdf",
    r"C:\Users\Lenovo\Downloads\StockConnect-Marketplace-Integrations-Guide.pdf",
]
out_dir = Path(r"c:\Users\Lenovo\Downloads\nexora\nexora-backend\tmp_pdf_text")
out_dir.mkdir(exist_ok=True)

for pdf_path in pdfs:
    name = Path(pdf_path).stem
    reader = PdfReader(pdf_path)
    parts = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        parts.append(f"\n--- PAGE {i+1} ---\n{text}")
    full = "\n".join(parts)
    out_file = out_dir / f"{name}.txt"
    out_file.write_text(full, encoding="utf-8")
    print(f"{name}: {len(reader.pages)} pages, {len(full)} chars -> {out_file}")

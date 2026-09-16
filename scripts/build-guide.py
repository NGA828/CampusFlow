#!/usr/bin/env python3
"""Build the handover PDF; optional dependencies in docs/guides/requirements.txt."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Preformatted, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/guides/guide.md'
OUTPUT = ROOT / 'docs/guides/guide.pdf'
# Prefer readable, embedded Unicode fonts; portable fallback uses built-in fonts.
fontdir = Path('/usr/share/fonts/truetype/dejavu')
if (fontdir / 'DejaVuSans.ttf').exists():
    for name, file in [('Guide', 'DejaVuSans.ttf'), ('GuideBold', 'DejaVuSans-Bold.ttf'), ('GuideMono', 'DejaVuSansMono.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(fontdir / file)))
    NORMAL, BOLD, MONO = 'Guide', 'GuideBold', 'GuideMono'
else:
    NORMAL, BOLD, MONO = 'Helvetica', 'Helvetica-Bold', 'Courier'
NAVY = colors.HexColor('#122C42')
TEAL = colors.HexColor('#087F8C')
GRAY = colors.HexColor('#52616C')
PAGE_W, PAGE_H = 210*mm, 297*mm
styles = {
 'body': ParagraphStyle('Body', fontName=NORMAL, fontSize=9.1, leading=14, spaceAfter=7, textColor=NAVY),
 'h1': ParagraphStyle('Chapter', fontName=BOLD, fontSize=22, leading=28, textColor=NAVY, spaceAfter=18, keepWithNext=True),
 'h2': ParagraphStyle('Section', fontName=BOLD, fontSize=13, leading=18, textColor=TEAL, spaceBefore=13, spaceAfter=9, keepWithNext=True),
 'h3': ParagraphStyle('Case', fontName=BOLD, fontSize=10, leading=15, textColor=NAVY, spaceBefore=12, spaceAfter=5, keepWithNext=True),
 'bullet': ParagraphStyle('Bullet', fontName=NORMAL, fontSize=9.1, leading=14, textColor=NAVY, leftIndent=12, firstLineIndent=-8, spaceAfter=5),
 'code': ParagraphStyle('Code', fontName=MONO, fontSize=7.1, leading=10.5, backColor=colors.HexColor('#EEF3F5'), borderPadding=9, spaceBefore=6, spaceAfter=12),
}

def inline(text):
    text = escape(text)
    return re.sub(r'`([^`]+)`', rf'<font name="{MONO}">\1</font>', text)

class GuideDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(str(filename), pagesize=(PAGE_W, PAGE_H),
                         leftMargin=20*mm, rightMargin=20*mm,
                         topMargin=23*mm, bottomMargin=22*mm,
                         title='CampusFlow | Setup, User & Test Guide',
                         author='CampusFlow project documentation',
                         subject='New-machine setup, application walkthrough and 95 acceptance test scenarios')
        self.addPageTemplates(PageTemplate(id='guide', frames=[Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='content', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=self.decorate))
    def decorate(self, canvas, doc):
        if doc.page == 1:
            canvas.setFillColor(TEAL)
            canvas.rect(0, PAGE_H-9*mm, PAGE_W, 9*mm, fill=1, stroke=0)
        else:
            canvas.setFont(BOLD, 8)
            canvas.setFillColor(TEAL)
            canvas.drawString(20*mm, PAGE_H-14*mm, 'CAMPUSFLOW')
            canvas.setFont(NORMAL, 7.5)
            canvas.setFillColor(GRAY)
            canvas.drawRightString(PAGE_W-20*mm, PAGE_H-14*mm, 'SETUP / USE / TEST')
            canvas.setStrokeColor(colors.HexColor('#DCE5E9'))
            canvas.line(20*mm, PAGE_H-17*mm, PAGE_W-20*mm, PAGE_H-17*mm)
        canvas.setFont(NORMAL, 7)
        canvas.setFillColor(GRAY)
        canvas.drawString(20*mm, 12*mm, '16 Sep 2026  |  Code-reviewed guide; manual tests not yet executed')
        canvas.drawRightString(PAGE_W-20*mm, 12*mm, str(doc.page))
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and hasattr(flowable, 'bookmark'):
            level, key = flowable.bookmark
            text = flowable.getPlainText()
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=(level > 0))
            self.notify('TOCEntry', (level, text, self.page, key))

lines = SOURCE.read_text().splitlines()
story=[]
# Cover content comes from the editable source introduction.
start = next(i for i,l in enumerate(lines) if l.startswith('# 1.'))
story.append(Spacer(1, 31*mm))
story.append(Paragraph('CAMPUSFLOW', ParagraphStyle('Brand', fontName=BOLD, fontSize=33, leading=40, textColor=NAVY, spaceAfter=13)))
story.append(Paragraph('Setup, user<br/>&amp; test guide', ParagraphStyle('CoverTitle', fontName=BOLD, fontSize=29, leading=37, textColor=TEAL, spaceAfter=20)))
for line in lines[3:start]:
    if line.strip(): story.append(Paragraph(inline(line), styles['body']))
story.append(Spacer(1,12*mm))
story.append(Paragraph('NEW MACHINE → FIRST LOGIN → ROLE WORKFLOWS → ACCEPTANCE', styles['h3']))
story.append(Paragraph('95 test scenarios • Web + mobile • Editable source included', styles['body']))
story.append(PageBreak())
story.append(Paragraph('Contents', styles['h1']))
toc=TableOfContents()
toc.levelStyles=[
 ParagraphStyle('Toc1', fontName=BOLD, fontSize=10, leading=15, spaceBefore=9, textColor=NAVY),
 ParagraphStyle('Toc2', fontName=NORMAL, fontSize=8.5, leading=12, leftIndent=12, textColor=GRAY),
]
story.append(toc)

paragraph=[]
key_counter=0

def flush():
    if paragraph:
        story.append(Paragraph(inline(' '.join(paragraph)), styles['body']))
        paragraph.clear()

i=start
while i < len(lines):
    line=lines[i]
    if line.startswith('```'):
        flush(); code=[]; i+=1
        while i<len(lines) and not lines[i].startswith('```'):
            code.append(lines[i]); i+=1
        # Wrap long comments/commands at visual line breaks; source retains copyable originals.
        import textwrap
        wrapped=[]
        for c in code:
            wrapped.extend(textwrap.wrap(c, width=104, subsequent_indent='    ', replace_whitespace=False, drop_whitespace=False) or [''])
        story.append(Preformatted('\n'.join(wrapped), styles['code']))
    elif re.match(r'^#{1,3} ', line):
        flush(); n=len(line)-len(line.lstrip('#')); text=line[n+1:]
        if n==1: story.append(PageBreak())
        p=Paragraph(inline(text), styles[f'h{n}'])
        if n<=2:
            key_counter+=1; p.bookmark=(n-1, f'section-{key_counter}')
        story.append(p)
    elif line.startswith('- ') or re.match(r'^\d+\. ',line):
        flush()
        text='• '+line[2:] if line.startswith('- ') else line
        story.append(Paragraph(inline(text), styles['bullet']))
    elif not line.strip(): flush()
    else: paragraph.append(line)
    i+=1
flush()
GuideDoc(OUTPUT).multiBuild(story)
print(f'Created {OUTPUT}')

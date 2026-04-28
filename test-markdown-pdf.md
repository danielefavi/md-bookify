# Heading Level 1
## Heading Level 2
### Heading Level 3
#### Heading Level 4
##### Heading Level 5
###### Heading Level 6

---

## Typography & Inline Formatting

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

**Bold text using double asterisks**  
__Bold text using double underscores__  
*Italic text using single asterisk*  
_Italic text using single underscore_  
***Bold and italic combined***  
~~Strikethrough text~~  
`Inline code snippet`  
<mark>Highlighted text using HTML mark tag</mark>  
<u>Underlined text using HTML u tag</u>  
<s>Strikethrough using HTML s tag</s>  
<small>Small text using HTML small tag</small>  
<sup>Superscript</sup> and <sub>Subscript</sub> text  
H<sub>2</sub>O and E = mc<sup>2</sup>

---

## Paragraphs & Line Breaks

This is the first paragraph. It contains multiple sentences to demonstrate paragraph spacing and line wrapping behavior across different screen widths and PDF renderers.

This is the second paragraph, separated by a blank line.

This line ends with two spaces for a soft line break.  
This is the next line after the soft break.

---

## Blockquotes

> This is a simple blockquote.

> This is a blockquote with **bold**, *italic*, and `code` inside it.
>
> It spans multiple paragraphs.

> Nested blockquotes:
> > This is a nested blockquote level 2.
> > > This is a nested blockquote level 3.

---

## Lists

### Unordered Lists

- Item one
- Item two
  - Nested item 2a
  - Nested item 2b
    - Deeply nested item
- Item three

* Asterisk bullet one
* Asterisk bullet two

+ Plus bullet one
+ Plus bullet two

### Ordered Lists

1. First item
2. Second item
   1. Nested ordered item 2a
   2. Nested ordered item 2b
3. Third item
4. Fourth item

### Mixed Nested Lists

1. Ordered item one
   - Unordered sub-item A
   - Unordered sub-item B
2. Ordered item two
   - Unordered sub-item C
     1. Deeply nested ordered
     2. Deeply nested ordered again

### Task Lists (Checkboxes)

- [x] Completed task
- [x] Another completed task
- [ ] Incomplete task
- [ ] Another incomplete task
  - [x] Completed sub-task
  - [ ] Incomplete sub-task

---

## Code

### Inline Code

Use `npm install` to install dependencies. The variable `foo` holds the value `42`.

### Fenced Code Blocks

```
Plain code block with no language specified.
Indentation and spacing should be preserved.
```

```bash
#!/bin/bash
# Bash script example
echo "Hello, World!"
for i in {1..5}; do
  echo "Iteration $i"
done
```

```javascript
// JavaScript example
const greet = (name) => {
  return `Hello, ${name}!`;
};

async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

```python
# Python example
def fibonacci(n: int) -> list[int]:
    """Return the first n Fibonacci numbers."""
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

if __name__ == "__main__":
    print(fibonacci(10))
```

```css
/* CSS example */
:root {
  --primary-color: #3498db;
  --font-size-base: 16px;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
```

```json
{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21"
  },
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  }
}
```

```markdown
# Markdown Fenced Block

## Sub Title

Lorem ipsum dolor sit amet, **consectetur adipiscing elit**. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

```

```sql
-- SQL example
SELECT
    u.id,
    u.name,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2024-01-01'
GROUP BY u.id, u.name
ORDER BY total_spent DESC
LIMIT 10;
```

---

## Links

[Inline link](https://www.example.com)  
[Inline link with title](https://www.example.com "Example Website")  
[Reference link][ref1]  
[Another reference][ref2]  
<https://www.autolink-example.com>  
<email@example.com>

[ref1]: https://www.reference-one.com "Reference One"
[ref2]: https://www.reference-two.com

---

## Images

![Alt text for a placeholder image](https://placehold.co/600x200/3498db/ffffff?text=Test+Image+600x200)

![Smaller image](https://placehold.co/300x150/e74c3c/ffffff?text=300x150)

<!-- Image with reference style -->
![Reference image][img-ref]

[img-ref]: https://placehold.co/400x100/2ecc71/ffffff?text=Reference+Image

<!-- HTML image with explicit width -->
<img src="https://placehold.co/500x80/9b59b6/ffffff?text=HTML+img+tag" alt="HTML img tag" width="500" />

---

## Tables

### Simple Table

| Column A | Column B | Column C |
|----------|----------|----------|
| Row 1A   | Row 1B   | Row 1C   |
| Row 2A   | Row 2B   | Row 2C   |
| Row 3A   | Row 3B   | Row 3C   |

### Aligned Table

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Apple        | Banana         | Cherry        |
| 100          | 200            | 300           |
| Short        | A longer value | 99,999        |

### Table with Inline Formatting

| Feature         | Status     | Notes                          |
|-----------------|------------|--------------------------------|
| **Bold cells**  | ✅ Done    | Renders inline formatting      |
| *Italic cells*  | ✅ Done    | Works in most renderers        |
| `Code cells`    | ⚠️ Partial | Depends on the renderer        |
| [Link in cell](https://example.com) | ✅ Done | Clickable links |
| ~~Strikethrough~~ | ✅ Done | Standard GFM extension       |


### Table with Paragraphs

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

| Column A | Column B | Column C |
|----------|----------|----------|
| Row 1A   | Row 1B   | Row 1C   |
| Row 2A   | Row 2B   | Row 2C   |
| Row 3A   | Row 3B   | Row 3C   |

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

---

## Horizontal Rules

Three hyphens:

---

Three asterisks:

***

Three underscores:

___

---

## HTML Elements Commonly Used in Markdown

### Details / Summary (Collapsible Section)

<details>
<summary>Click to expand this section</summary>

This content is hidden by default and revealed on click. Useful for FAQs, long notes, or optional details.

- Item inside details
- Another item
- `code` inside details

</details>

<details open>
<summary>This section is open by default</summary>

This content is visible immediately because the `open` attribute is set.

```python
print("Code inside an open details block")
```

</details>

### Keyboard Keys

Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.  
Press <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> to open the command palette.  
Use <kbd>Tab</kbd> to indent and <kbd>Shift</kbd> + <kbd>Tab</kbd> to dedent.

### Abbreviations / Definitions

<abbr title="HyperText Markup Language">HTML</abbr> is the standard markup language.  
<abbr title="Cascading Style Sheets">CSS</abbr> describes how HTML elements are displayed.  
<abbr title="Application Programming Interface">API</abbr> allows applications to communicate.

### Definition Lists (HTML)

<dl>
  <dt>Markdown</dt>
  <dd>A lightweight markup language for creating formatted text.</dd>

  <dt>PDF</dt>
  <dd>Portable Document Format — a file format for presenting documents.</dd>

  <dt>CLI</dt>
  <dd>Command Line Interface — a text-based interface for interacting with software.</dd>
</dl>

### Figures and Captions

<figure>
  <img src="https://placehold.co/500x200/1abc9c/ffffff?text=Figure+with+Caption" alt="Figure example" width="500" />
  <figcaption>Fig. 1 — This is an HTML figure caption below an image.</figcaption>
</figure>

### Preformatted Text

<pre>
This is preformatted text.
    Indentation is preserved.
        And so are    multiple spaces.
Line breaks are also kept as-is.
</pre>

### Inline Styles & Semantic HTML

<p style="color: #e74c3c; font-weight: bold;">Red bold paragraph using inline style.</p>

<p style="background-color: #f0f4c3; padding: 8px; border-left: 4px solid #cddc39;">
  Highlighted paragraph with left border using inline style.
</p>

<span style="font-family: monospace; font-size: 0.9em;">Monospace span text.</span>

<b>Bold via &lt;b&gt; tag</b> vs <strong>Bold via &lt;strong&gt; tag</strong>  
<i>Italic via &lt;i&gt; tag</i> vs <em>Italic via &lt;em&gt; tag</em>  
<cite>Citation text using cite tag</cite>  
<q>Inline quotation using the q tag</q>  
<code>Code via HTML code tag</code>  
<var>variable</var> using the var tag  
<time datetime="2025-01-01">January 1st, 2025</time>

### Divs and Spans for Layout

<div style="display: flex; gap: 1rem;">
  <div style="flex: 1; background: #dfe6e9; padding: 8px; border-radius: 4px;">Column 1</div>
  <div style="flex: 1; background: #dfe6e9; padding: 8px; border-radius: 4px;">Column 2</div>
  <div style="flex: 1; background: #dfe6e9; padding: 8px; border-radius: 4px;">Column 3</div>
</div>

### HTML Comments

<!-- This is an HTML comment and should NOT appear in the rendered output -->

---

## Footnotes

Here is a sentence with a footnote.[^1]

This sentence references a second footnote.[^note]

[^1]: This is the first footnote at the bottom of the document.
[^note]: This is a named footnote with additional detail. It can span multiple lines if needed.

---

## Emoji

Emojis via unicode characters: 🚀 🎉 ✅ ⚠️ ❌ 💡 📄 🔧 🐍 🌐  
Emojis via shortcodes (if supported): :rocket: :tada: :white_check_mark:

---

## Mathematical Expressions (LaTeX — if supported)

Inline math: $E = mc^2$ and $a^2 + b^2 = c^2$

Block math:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

$$
f(x) = \frac{1}{\sigma\sqrt{2\pi}} \exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)
$$

---

## Special Characters & Escaping

Escaped characters: \* \_ \` \\ \# \[ \] \( \) \{ \} \| \~ \!

HTML entities: &copy; &reg; &trade; &mdash; &ndash; &hellip; &amp; &lt; &gt; &quot; &nbsp;

Unicode: — (em dash), – (en dash), … (ellipsis), " " (smart quotes), ' ' (smart single quotes)

---

## Miscellaneous

### Long Unbroken String (Word Wrap Test)

`averylongvariablenamethatdoesnotcontainanyspacesorseparatorsandshouldforcewraporoverflowdependingontherendereraverylongvariablenamethatdoesnotcontainanyspacesorseparatorsandshouldforcewraporoverflowdependingontherenderer`

### Deeply Nested Blockquote + Code

> Level 1
> > Level 2
> > ```js
> > const nested = "code inside blockquote";
> > ```

### Empty Table Cells

| A  | B  | C  |
|----|----|----|
|    | X  |    |
| Y  |    | Z  |
|    |    |    |

### Very Long Table Row

| Short | This cell contains a significantly longer string of text to test how the table renders when content overflows the available column width in a PDF |
|-------|------------------------------------------------------------------------------------------------------------------------------------------------|
| A     | Normal cell                                                                                                                                    |

---

*End of test document.*

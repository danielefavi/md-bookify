import { describe, it, expect } from 'vitest';
import { insertWordBreaks } from '../src/epub.js';

const ZWSP = '\u200B';

describe('insertWordBreaks', () => {
  it('inserts ZWSP every 20 chars in a long unbroken word', () => {
    // 25 chars → break after position 20
    const word = 'a'.repeat(25);
    const result = insertWordBreaks(word);
    expect(result).toBe('a'.repeat(20) + ZWSP + 'a'.repeat(5));
  });

  it('does not modify words of 20 chars or fewer', () => {
    const word = 'a'.repeat(20);
    const result = insertWordBreaks(word);
    expect(result).toBe(word);
  });

  it('leaves short text unchanged', () => {
    const text = 'Hello world';
    expect(insertWordBreaks(text)).toBe(text);
  });

  it('returns empty string for empty input', () => {
    expect(insertWordBreaks('')).toBe('');
  });

  it('does not break inside HTML tags', () => {
    const longAttr = 'x'.repeat(30);
    const html = `<div class="${longAttr}">short</div>`;
    const result = insertWordBreaks(html);
    // The tag should be preserved exactly as-is
    expect(result).toContain(`class="${longAttr}"`);
    expect(result).toBe(html);
  });

  it('breaks long text nodes but preserves surrounding tags', () => {
    const longWord = 'abcdefghij'.repeat(5); // 50 chars
    const html = `<p>${longWord}</p>`;
    const result = insertWordBreaks(html);
    expect(result).toContain('<p>');
    expect(result).toContain('</p>');
    expect(result).toContain(ZWSP);
    // Tags should not contain ZWSP
    expect(result.match(/<[^>]*>/g)!.every((tag) => !tag.includes(ZWSP))).toBe(true);
  });

  it('respects custom maxLen parameter', () => {
    // 25 chars with maxLen=5 → breaks at 5, 10, 15, 20
    const word = 'a'.repeat(25);
    const result = insertWordBreaks(word, 5);
    const expected =
      'a'.repeat(5) + ZWSP +
      'a'.repeat(5) + ZWSP +
      'a'.repeat(5) + ZWSP +
      'a'.repeat(5) + ZWSP +
      'a'.repeat(5);
    expect(result).toBe(expected);
  });

  it('handles multiple long words in the same text node', () => {
    const word1 = 'a'.repeat(25);
    const word2 = 'b'.repeat(30);
    const text = `${word1} ${word2}`;
    const result = insertWordBreaks(text);
    // Both words should contain ZWSP
    expect(result.split(' ')[0]).toContain(ZWSP);
    expect(result.split(' ')[1]).toContain(ZWSP);
    // Space between them preserved
    expect(result).toContain(' ');
  });

  it('does not break words separated by whitespace even if total is long', () => {
    const text = 'short words that are not long individually';
    expect(insertWordBreaks(text)).toBe(text);
  });

  it('handles long URLs in text content', () => {
    const url = 'https://example.com/very/long/path/that/exceeds/twenty/characters';
    const result = insertWordBreaks(url);
    expect(result).toContain(ZWSP);
    // Should still contain all original chars
    expect(result.replace(new RegExp(ZWSP, 'g'), '')).toBe(url);
  });

  it('handles mixed short and long content with tags', () => {
    const longWord = 'x'.repeat(30);
    const html = `<p>Short <strong>${longWord}</strong> end</p>`;
    const result = insertWordBreaks(html);
    // Tags preserved
    expect(result).toContain('<strong>');
    expect(result).toContain('</strong>');
    // Long word broken
    const strongContent = result.match(/<strong>(.*?)<\/strong>/)![1];
    expect(strongContent).toContain(ZWSP);
    // Short words not broken
    expect(result).toContain('Short ');
    expect(result).toContain(' end');
  });

  it('inserts breaks at correct positions for 40-char word with default maxLen', () => {
    const word = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD'; // 40 chars
    const result = insertWordBreaks(word);
    // Breaks at position 20
    const parts = result.split(ZWSP);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe('abcdefghijklmnopqrst');
    expect(parts[1]).toBe('uvwxyz0123456789ABCD');
  });

  it('inserts breaks at correct positions for 60-char word', () => {
    const word = 'a'.repeat(60);
    const result = insertWordBreaks(word);
    const parts = result.split(ZWSP);
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('a'.repeat(20));
    expect(parts[1]).toBe('a'.repeat(20));
    expect(parts[2]).toBe('a'.repeat(20));
  });

  it('preserves 21-char word but adds one break', () => {
    const word = 'a'.repeat(21);
    const result = insertWordBreaks(word);
    expect(result).toBe('a'.repeat(20) + ZWSP + 'a');
  });
});

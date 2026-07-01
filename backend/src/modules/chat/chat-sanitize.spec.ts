import { sanitizeChatContent } from './chat-sanitize';

describe('sanitizeChatContent', () => {
  it('strips HTML tags', () => {
    expect(sanitizeChatContent('<b>Hello</b> world')).toBe('Hello world');
  });

  it('removes script blocks', () => {
    expect(sanitizeChatContent('Hi<script>alert(1)</script>')).toBe('Hi');
  });

  it('removes javascript: URIs', () => {
    expect(sanitizeChatContent('javascript:alert(1)')).toBe('alert(1)');
  });
});

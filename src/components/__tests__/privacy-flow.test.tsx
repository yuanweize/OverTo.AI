import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { VerificationWorkflow } from '../VerificationWorkflow';

// React's act environment is required when exercising the real client interactions.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('review and verification flow', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('does not transmit until reviewed and sends redacted URL with explicit AI consent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'test' }) });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => { root.render(<Home />); });
    const scenario = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Falešná SMS České pošty'));
    expect(scenario).toBeDefined();
    await act(async () => { scenario!.click(); });
    const prepare = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Pokračovat ke kontrole'))!;
    await act(async () => { prepare.click(); });
    expect(fetchMock).not.toHaveBeenCalled();
    const preview = container.querySelector<HTMLTextAreaElement>('#preview-text')!;
    expect(preview.value).toContain('ceskaposta.cz-sledovani.xyz/');
    expect(preview.value).not.toContain('/track');
    const submit = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Odeslat a analyzovat'))!;
    expect(submit.disabled).toBe(true);
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
    await act(async () => { boxes[0].click(); boxes[1].click(); });
    await act(async () => { submit.click(); });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe(preview.value);
    expect(body.text).not.toContain('/track');
    expect(body.enableLlm).toBe(true);
    expect(body.aiConsent).toBe(true);
  });

  it('changes guidance according to action already taken', async () => {
    await act(async () => { root.render(<VerificationWorkflow categories={['FAMILY_EMERGENCY']} />); });
    const none = container.querySelector<HTMLInputElement>('input[value=none]')!;
    await act(async () => { none.click(); });
    expect(container.textContent).toContain('Zavolejte příbuznému');
    const transfer = container.querySelector<HTMLInputElement>('input[value=transfer]')!;
    await act(async () => { transfer.click(); });
    expect(container.textContent).toContain('případné zastavení platby');
    expect(container.textContent).not.toContain('Zavolejte příbuznému');
  });
});

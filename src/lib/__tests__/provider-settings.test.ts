import {describe,it,expect} from 'vitest';
import {defaultProviderSettings,isAllowedProviderBaseUrl,validateProviderSettings} from '@/ai/providers-config';
const valid={enabled:true,model:'synthetic-model',allowedModels:['synthetic-model'],timeoutMs:1000,maxCompletionTokens:900};
describe('provider configuration limits',()=>{
  it('accepts bounded configuration with an explicitly allowed model',()=>expect(validateProviderSettings(valid)).toEqual({...valid,providerName:defaultProviderSettings().providerName,baseUrl:defaultProviderSettings().baseUrl}));
  it('rejects unregistered endpoints and credentials embedded in URLs',()=>{
    expect(isAllowedProviderBaseUrl('https://unregistered.example/v1')).toBe(false);
    expect(()=>validateProviderSettings({...valid,baseUrl:'https://key@api.example/v1'})).toThrow('INVALID_PROVIDER_CONFIG');
  });
  it.each([{model:'other'},{timeoutMs:45001},{timeoutMs:0},{maxCompletionTokens:2001},{allowedModels:[]},{allowedModels:['model\nsecret']},{apiKey:'should-not-be-stored'},{enabled:'true'}])('rejects invalid or secret-bearing settings %j',changes=>expect(()=>validateProviderSettings({...valid,...changes})).toThrow('INVALID_PROVIDER_CONFIG'));
});

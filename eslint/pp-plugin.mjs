// Local ESLint plugin `pp` (V2-T04): design-system guard rules for strict files.
import dsClassAllowlist from './rules/ds-class-allowlist.mjs'
import dsIconNames from './rules/ds-icon-names.mjs'
import dsNoDynamicClass from './rules/ds-no-dynamic-class.mjs'
import dsNoInlineStyle from './rules/ds-no-inline-style.mjs'
import dsNoRemoteAssets from './rules/ds-no-remote-assets.mjs'
import dsNoStyleBlock from './rules/ds-no-style-block.mjs'

export default {
  meta: { name: 'pp' },
  rules: {
    'ds-class-allowlist': dsClassAllowlist,
    'ds-icon-names': dsIconNames,
    'ds-no-dynamic-class': dsNoDynamicClass,
    'ds-no-inline-style': dsNoInlineStyle,
    'ds-no-remote-assets': dsNoRemoteAssets,
    'ds-no-style-block': dsNoStyleBlock,
  },
}

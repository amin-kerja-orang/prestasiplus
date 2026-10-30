// Local ESLint plugin `pp` (V2-T04): design-system guard rules for strict files.
// R1-R14 (strict Portal Pentadbiran rules, docs/design/v2-ds-hardening.md) are listed below the
// original six.
import dsClassAllowlist from './rules/ds-class-allowlist.mjs'
import dsCopyGlossary from './rules/ds-copy-glossary.mjs'
import dsIconNames from './rules/ds-icon-names.mjs'
import dsImports from './rules/ds-imports.mjs'
import dsNoAdhocFormat from './rules/ds-no-adhoc-format.mjs'
import dsNoClassAttr from './rules/ds-no-class-attr.mjs'
import dsNoClassLiteralInScript from './rules/ds-no-class-literal-in-script.mjs'
import dsNoDeprecatedDsProps from './rules/ds-no-deprecated-ds-props.mjs'
import dsNoDynamicClass from './rules/ds-no-dynamic-class.mjs'
import dsNoInlineStyle from './rules/ds-no-inline-style.mjs'
import dsNoLocalKit from './rules/ds-no-local-kit.mjs'
import dsNoRawHtml from './rules/ds-no-raw-html.mjs'
import dsNoRemoteAssets from './rules/ds-no-remote-assets.mjs'
import dsNoStyle from './rules/ds-no-style.mjs'
import dsNoStyleBlock from './rules/ds-no-style-block.mjs'
import dsNoUiDuplicate from './rules/ds-no-ui-duplicate.mjs'
import dsNoUiProp from './rules/ds-no-ui-prop.mjs'
import dsPageTemplate from './rules/ds-page-template.mjs'
import dsUiAllowlist from './rules/ds-ui-allowlist.mjs'

export default {
  meta: { name: 'pp' },
  rules: {
    'ds-class-allowlist': dsClassAllowlist,
    'ds-icon-names': dsIconNames,
    'ds-no-dynamic-class': dsNoDynamicClass,
    'ds-no-inline-style': dsNoInlineStyle,
    'ds-no-remote-assets': dsNoRemoteAssets,
    'ds-no-style-block': dsNoStyleBlock,
    'ds-no-class-attr': dsNoClassAttr, // R1
    'ds-no-class-literal-in-script': dsNoClassLiteralInScript, // R2
    'ds-no-ui-prop': dsNoUiProp, // R3
    'ds-no-style': dsNoStyle, // R4
    'ds-no-raw-html': dsNoRawHtml, // R5
    'ds-no-ui-duplicate': dsNoUiDuplicate, // R6
    'ds-ui-allowlist': dsUiAllowlist, // R7
    'ds-no-local-kit': dsNoLocalKit, // R8
    // R9 = ds-icon-names with { baseNamesOnly: true }
    'ds-imports': dsImports, // R10
    'ds-copy-glossary': dsCopyGlossary, // R11
    'ds-page-template': dsPageTemplate, // R12
    'ds-no-deprecated-ds-props': dsNoDeprecatedDsProps, // R13
    'ds-no-adhoc-format': dsNoAdhocFormat, // R14
  },
}

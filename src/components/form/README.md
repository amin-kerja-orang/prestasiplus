# Forms

Live forms use native HTML5 validation (design-system §7.2, overview §9): plain
`<form @submit.prevent="submit">` with native attributes (`required`, `type="email"`,
`maxlength`, `accept`). The browser validates before `submit` fires, so never add `novalidate`
and never replace the bubble with custom BM messages. Only server `VALIDATION_ERROR`s render,
in an `AlertBox` above the form (one line per message), with the field marked by
`FORM_ERROR_MODIFIER` and `FORM_ERROR_TEXT_CLASS` helper text. Use the class strings from
`classes.ts`; keep the form values after a server error.

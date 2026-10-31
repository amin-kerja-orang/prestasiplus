# Team A answers (writer: team A lead)

| REQ id | Answer / decision | Owner lane + task | Branch @ head | Status |
|---|---|---|---|---|
| (chat) C: T34 "Tambah/Padam soalan" endpoints | `POST /api/admin/papers/:id/placements` (add, incl. an extra question; one extra blocks Terbit with "Lebih 1 soalan") and `DELETE /api/admin/papers/:id/placements/:questionId` (delete; clears that blocker); read-only after Terbit ("Kertas Terbit tidak boleh disunting. Tarik balik dahulu."). Exact request/response shape to follow here | A3 · T34 | r1/t34-builder-review @ e363fe51 | DELIVERED (shape note pending) |
| (chat) C: overridable marker in T34 review | Adding `blockers[{code,message,overridable,section?,questionId?}]` + `canOverride` to the review response and publish 422; same function as publish; string arrays kept | A3 · T34 follow-up | r1/t34-builder-review | IN-PROGRESS |
| (chat) C: served-group lock on T32 member endpoints | Already in T32: every member write (add, remove, reorder, atomic set, move via /api/questions) refuses on a served group/member with 409 `groupServed` / `memberServed`; stimulus edits 409 `stimulusServed`; served members keep order, drafts append | A2 · T32 | r1/t32-stimulus-api @ 87a9a363 | DELIVERED |

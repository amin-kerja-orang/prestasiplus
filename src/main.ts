import { bootstrap } from './app/bootstrap'
import { showBootError, watchSlowBoot } from './app/boot-error'
import './styles/main.css'

// Transport (mock | http), Pinia, router and mount: `src/app/bootstrap.ts` (F-13, overview §4).
// A failed boot shows a visible error with a reload button; a slow one changes the splash text.
watchSlowBoot()
bootstrap().catch(showBootError)

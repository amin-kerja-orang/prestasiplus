import { ref } from 'vue'

/**
 * Id of the MathField whose keypad is open (null = none). One keypad at a time: the keypad is
 * docked at the bottom of the screen, so two open ones would sit on top of each other.
 */
export const openKeypad = ref<string | null>(null)

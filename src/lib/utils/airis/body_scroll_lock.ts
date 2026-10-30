/** Nested dialogs share the original body overflow and release only their own lock. */
const locks = new WeakMap<object, { count: number; overflow: string }>();
export function lockBodyScroll(body: { style: { overflow: string } }): () => void {
	let lock = locks.get(body);
	if (!lock) {
		lock = { count: 0, overflow: body.style.overflow };
		locks.set(body, lock);
	}
	lock.count += 1;
	body.style.overflow = 'hidden';
	let released = false;
	return (): void => {
		if (released) return;
		released = true;
		lock.count -= 1;
		if (lock.count === 0) {
			body.style.overflow = lock.overflow;
			locks.delete(body);
		}
	};
}

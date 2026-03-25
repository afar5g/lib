/*

Copyright 2021 Logan R. Kearsley

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

/* Modified by afar5g. */

class Diff {
	static _fast_myers_diff_internal(state, c) {
		const { b, eq, stack_base } = state;
		let { i, N, j, M, Z, stack_top } = state;

		for (;;) {
			switch (c) {
			case 0: {
				Z_block: while (N > 0 && M > 0) {
				b.fill(0, 0, 2 * Z);

				const W = N - M;
				const L = N + M;
				const parity = L & 1;
				const offsetx = i + N - 1;
				const offsety = j + M - 1;
				const hmax = (L + parity) / 2;

				let z;

				h_loop: for (let h = 0; h <= hmax; h++) {
					const kmin = 2 * Math.max(0, h - M) - h;
					const kmax = h - 2 * Math.max(0, h - N);

					for (let k = kmin; k <= kmax; k += 2) {
					const gkm = b[k - 1 - Z * Math.floor((k - 1) / Z)];
					const gkp = b[k + 1 - Z * Math.floor((k + 1) / Z)];
					const u = (k === -h || (k !== h && gkm < gkp)) ? gkp : gkm + 1;
					const v = u - k;

					let x = u;
					let y = v;
					while (x < N && y < M && eq(i + x, j + y)) x++, y++;

					b[k - Z * Math.floor(k / Z)] = x;

					if (
						parity === 1 &&
						(z = W - k) >= 1 - h &&
						z < h &&
						x + b[Z + z - Z * Math.floor(z / Z)] >= N
					) {
						if (h > 1 || x !== u) {
						stack_base[stack_top++] = i + x;
						stack_base[stack_top++] = N - x;
						stack_base[stack_top++] = j + y;
						stack_base[stack_top++] = M - y;

						N = u;
						M = v;
						Z = 2 * (Math.min(N, M) + 1);
						continue Z_block;
						} else {
						break h_loop;
						}
					}
					}

					for (let k = kmin; k <= kmax; k += 2) {
					const pkm = b[Z + k - 1 - Z * Math.floor((k - 1) / Z)];
					const pkp = b[Z + k + 1 - Z * Math.floor((k + 1) / Z)];
					const u = (k === -h || (k !== h && pkm < pkp)) ? pkp : pkm + 1;
					const v = u - k;

					let x = u;
					let y = v;
					while (x < N && y < M && eq(offsetx - x, offsety - y)) x++, y++;

					b[Z + k - Z * Math.floor(k / Z)] = x;

					if (
						parity === 0 &&
						(z = W - k) >= -h &&
						z <= h &&
						x + b[z - Z * Math.floor(z / Z)] >= N
					) {
						if (h > 0 || x !== u) {
						stack_base[stack_top++] = i + N - u;
						stack_base[stack_top++] = u;
						stack_base[stack_top++] = j + M - v;
						stack_base[stack_top++] = v;

						N = N - x;
						M = M - y;
						Z = 2 * (Math.min(N, M) + 1);
						continue Z_block;
						} else {
						break h_loop;
						}
					}
					}
				}

				if (N === M) continue;

				if (M > N) {
					i += N;
					j += N;
					M -= N;
					N = 0;
				} else {
					i += M;
					j += M;
					N -= M;
					M = 0;
				}

				break;
				}

				if (N + M !== 0) {
				if (state.pxe === i || state.pye === j) {
					state.pxe = i + N;
					state.pye = j + M;
				} else {
					const sx = state.pxs;
					state.oxs = state.pxs;
					state.oxe = state.pxe;
					state.oys = state.pys;
					state.oye = state.pye;

					state.pxs = i;
					state.pxe = i + N;
					state.pys = j;
					state.pye = j + M;

					if (sx >= 0) {
					state.i = i;
					state.N = N;
					state.j = j;
					state.M = M;
					state.Z = Z;
					state.stack_top = stack_top;
					return 1;
					}
				}
				}
			}
			// fall through
			case 1: {
				if (stack_top === 0) return 2;

				M = stack_base[--stack_top];
				j = stack_base[--stack_top];
				N = stack_base[--stack_top];
				i = stack_base[--stack_top];
				Z = 2 * (Math.min(N, M) + 1);
				c = 0;
			}
			}
		}
	}

	static* _diff_core(i, N, j, M, eq) {
		const Z = (Math.min(N, M) + 1) * 2;
		const L = N + M;
		const b = new (L < 256 ? Uint8Array : L < 65536 ? Uint16Array : Uint32Array)(2 * Z);

		const state = {
			i, N, j, M, Z, b, eq,
			pxs: -1, pxe: -1, pys: -1, pye: -1,
			oxs: -1, oxe: -1, oys: -1, oye: -1,
			stack_top: 0,
			stack_base: []
		};

		let c = 0;
		while (c <= 1) {
			c = Diff._fast_myers_diff_internal(state, c);
			if (c === 1) {
				yield [state.oxs, state.oxe, state.oys, state.oye];
			} else if (state.pxs >= 0) {
				yield [state.pxs, state.pxe, state.pys, state.pye];
			} else {
				return;
			}
		}
	}

	static _diff_diff(xs, ys, eq) {
		let [i, N, M] = [0, xs.length, ys.length];

		if (typeof eq === "function") {
			while (i < N && i < M && eq(i, i)) i++;
			if (i === N && i === M) return [][Symbol.iterator]();
			while (eq(--N, --M) && N > i && M > i);
		} else {
			while (i < N && i < M && xs[i] === ys[i]) i++;
			if (i === N && i === M) return [][Symbol.iterator]();
			while (xs[--N] === ys[--M] && N > i && M > i);
			eq = (i, j) => xs[i] === ys[j];
		}

		return Diff._diff_core(i, N + 1 - i, i, M + 1 - i, eq);
	}

	static _compactDiff(diffIter, b) {
		const changes = []
		for (const [ds, de, is, ie] of diffIter) {
			const insert = b.slice(is, ie)

			const last = changes[changes.length - 1];
			if (last && last[0] + last[1] === ds) {
				last[1] += de - ds
				last[2] += insert
			} else { // [0 index, 1 delete_count, 2 new_text]
				changes.push([ds, de - ds, insert])
			}
		}
		return changes
	}

	static str_diff(old_str, new_str) {
		return JSON.stringify(Diff._compactDiff(Diff._diff_diff(old_str, new_str), new_str))
	}

	static apply_diff(old_str, str_diff) {
		const changes = JSON.parse(str_diff)
		for (let i = changes.length - 1; i >= 0; i--) {
			const change = changes[i]
			const index = change[0]
			old_str = old_str.slice(0, index) + change[2] + old_str.slice(index + change[1])
		}
		return old_str
	}
}

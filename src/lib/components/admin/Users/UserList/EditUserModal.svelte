<script lang="ts">
	import { toast } from 'svelte-sonner';
	import dayjs from 'dayjs';
	import { createEventDispatcher } from 'svelte';
	import { getContext } from 'svelte';

	import { goto } from '$app/navigation';

	import { updateUserById, getUserGroupsById } from '$lib/apis/users';
	import {
		getUserSubscription,
		getActivePlans,
		changeUserSubscription,
		getUserWalletAdmin,
		adjustUserWalletAdmin,
		type UserSubscriptionInfo,
		type Plan,
		type UserWalletSummaryResponse
	} from '$lib/apis/admin/billing';
	import {
		formatCompactNumber,
		getUsageColor
	} from '$lib/utils/billing-formatters';
	import {
		buildWalletAdjustmentRequest,
		parseRubleAmountToKopeks,
		validateWalletAdjustmentInput
	} from '$lib/utils/airis/admin_billing_user_wallet';

	import Modal from '$lib/components/common/Modal.svelte';
	import localizedFormat from 'dayjs/plugin/localizedFormat';
	import XMark from '$lib/components/icons/XMark.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import UserProfileImage from '$lib/components/chat/Settings/Account/UserProfileImage.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();
	dayjs.extend(localizedFormat);

	// Types
	interface UserFormData {
		id?: string;
		profile_image_url: string;
		role: string;
		name: string;
		email: string;
		password: string;
		oauth?: Record<string, { sub: string }>;
		created_at?: number;
	}

	interface UserGroup {
		id: string;
		name: string;
	}

	// Props
	export let show = false;
	export let selectedUser: UserFormData | null = null;
	export let sessionUser: { id: string; role: string } | null = null;

	// Reactive initialization
	$: if (show && selectedUser) {
		init();
	}

	const init = async () => {
		if (selectedUser) {
			_user = { ...selectedUser, password: '' };
			// Load data in parallel for better performance
			await Promise.all([
				loadUserGroups(),
				loadUserSubscription(),
				loadAvailablePlans(),
				loadUserWallet()
			]);
		}
	};

	// State
	let _user: UserFormData = {
		profile_image_url: '',
		role: 'pending',
		name: '',
		email: '',
		password: ''
	};

	let userGroups: UserGroup[] | null = null;
	let userSubscription: UserSubscriptionInfo | null = null;
	let subscriptionLoading = false;
	let plansLoading = false;
	let availablePlans: Plan[] = [];
	let selectedPlanId: string = '';
	let changingPlan = false;
	let walletSummary: UserWalletSummaryResponse | null = null;
	let walletLoading = false;
	let walletAdjusting = false;
	let walletDeltaTopupRub = '';
	let walletDeltaIncludedRub = '';
	let walletAdjustmentReason = '';

	// Handlers
	const submitHandler = async () => {
		if (!selectedUser?.id) return;

		const res = await updateUserById(localStorage.token, selectedUser.id, _user).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			dispatch('save');
			show = false;
		}
	};

	const loadUserGroups = async () => {
		if (!selectedUser?.id) return;
		userGroups = null;

		try {
			userGroups = await getUserGroupsById(localStorage.token, selectedUser.id);
		} catch (error) {
			console.error('Failed to load user groups:', error);
			toast.error($i18n.t('Failed to load user groups'));
			userGroups = [];
		}
	};

	const loadUserSubscription = async () => {
		if (!selectedUser?.id) return;
		subscriptionLoading = true;
		userSubscription = null;

		try {
			userSubscription = await getUserSubscription(localStorage.token, selectedUser.id);
			if (userSubscription?.plan) {
				selectedPlanId = userSubscription.plan.id;
			} else {
				selectedPlanId = '';
			}
		} catch (error) {
			console.error('Failed to load subscription:', error);
			toast.error($i18n.t('Failed to load subscription'));
		} finally {
			subscriptionLoading = false;
		}
	};

	const loadAvailablePlans = async () => {
		plansLoading = true;
		try {
			const plans = await getActivePlans(localStorage.token);
			if (plans) {
				availablePlans = plans;
			}
		} catch (error) {
			console.error('Failed to load plans:', error);
			toast.error($i18n.t('Failed to load plans'));
			availablePlans = [];
		} finally {
			plansLoading = false;
		}
	};

	const loadUserWallet = async () => {
		if (!selectedUser?.id || sessionUser?.role !== 'admin') {
			walletSummary = null;
			return;
		}

		walletLoading = true;
		try {
			walletSummary = await getUserWalletAdmin(localStorage.token, selectedUser.id);
		} catch (error) {
			console.error('Failed to load user wallet:', error);
			toast.error($i18n.t('Failed to load wallet'));
		} finally {
			walletLoading = false;
		}
	};

	const handleChangePlan = async () => {
		if (!selectedUser?.id) return;

		// Authorization check - only admins can change plans
		if (sessionUser?.role !== 'admin') {
			toast.error($i18n.t('Unauthorized: Admin access required'));
			return;
		}

		// If plan is cleared, don't save (for now we don't support removing subscription)
		if (!selectedPlanId) {
			// Restore previous plan selection if user clears
			if (userSubscription?.plan) {
				selectedPlanId = userSubscription.plan.id;
			}
			return;
		}

		// Don't save if plan hasn't changed
		if (userSubscription?.plan?.id === selectedPlanId) return;

		changingPlan = true;
		try {
			const result = await changeUserSubscription(localStorage.token, selectedUser.id, {
				plan_id: selectedPlanId,
				reset_usage: false
			});

			if (result?.success) {
				toast.success($i18n.t('Plan changed successfully'));
				await loadUserSubscription();
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error) || $i18n.t('Failed to change plan');
			toast.error(errorMessage);
			// Restore previous selection on error
			if (userSubscription?.plan) {
				selectedPlanId = userSubscription.plan.id;
			}
		} finally {
			changingPlan = false;
		}
	};

	const formatKopeksAmount = (amountKopeks: number): string =>
		(amountKopeks / 100).toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

	const handleAdjustWallet = async () => {
		if (!selectedUser?.id || sessionUser?.role !== 'admin') {
			return;
		}

		const createIdempotencyKey = (): string => {
			try {
				if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
					return crypto.randomUUID();
				}
			} catch {
				// ignore
			}
			return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
		};

		const topupParsed = parseRubleAmountToKopeks(walletDeltaTopupRub);
		if (!topupParsed.ok) {
			toast.error($i18n.t(topupParsed.error));
			return;
		}

		const includedParsed = parseRubleAmountToKopeks(walletDeltaIncludedRub);
		if (!includedParsed.ok) {
			toast.error($i18n.t(includedParsed.error));
			return;
		}

		const validationError = validateWalletAdjustmentInput({
			delta_topup_kopeks: topupParsed.kopeks,
			delta_included_kopeks: includedParsed.kopeks,
			reason: walletAdjustmentReason
		});
		if (validationError) {
			toast.error($i18n.t(validationError));
			return;
		}

		walletAdjusting = true;
		try {
			const idempotencyKey = createIdempotencyKey();
			await adjustUserWalletAdmin(
				localStorage.token,
				selectedUser.id,
				buildWalletAdjustmentRequest({
					delta_topup_kopeks: topupParsed.kopeks,
					delta_included_kopeks: includedParsed.kopeks,
					reason: walletAdjustmentReason,
					idempotency_key: idempotencyKey
				})
			);
			walletDeltaTopupRub = '';
			walletDeltaIncludedRub = '';
			walletAdjustmentReason = '';
			await loadUserWallet();
			toast.success($i18n.t('Wallet adjusted successfully'));
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error) || $i18n.t('Failed to adjust wallet');
			toast.error(errorMessage);
		} finally {
			walletAdjusting = false;
		}
	};
</script>

<Modal size="sm" bind:show>
	<div>
		<div class=" flex justify-between dark:text-gray-300 px-5 pt-4 pb-2">
			<div class=" text-lg font-medium self-center">{$i18n.t('Edit User')}</div>
			<button
				class="self-center"
				on:click={() => {
					show = false;
				}}
			>
				<XMark className={'size-5'} />
			</button>
		</div>

		<div class="flex flex-col md:flex-row w-full md:space-x-4 dark:text-gray-200">
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				<form
					class="flex flex-col w-full"
					on:submit|preventDefault={() => {
						submitHandler();
					}}
				>
					<div class=" px-5 pt-3 pb-5 w-full">
						<div class="flex self-center w-full">
							<div class=" self-start h-full mr-6">
								<UserProfileImage
									imageClassName="size-14"
									bind:profileImageUrl={_user.profile_image_url}
									user={_user}
								/>
							</div>

							<div class=" flex-1">
								<div class="overflow-hidden w-ful mb-2">
									<div class=" self-center capitalize font-medium truncate">
										{selectedUser?.name || ''}
									</div>

									<div class="text-xs text-gray-500">
										{$i18n.t('Created at')}
										{selectedUser?.created_at
											? dayjs(selectedUser.created_at * 1000).format('LL')
											: '-'}
									</div>
								</div>

								<div class=" flex flex-col space-y-1.5">
									{#if (userGroups ?? []).length > 0}
										<div class="flex flex-col w-full text-sm">
											<div class="mb-1 text-xs text-gray-500">{$i18n.t('User Groups')}</div>

											<div class="flex flex-wrap gap-1 my-0.5 -mx-1">
												{#each userGroups as userGroup}
													<span
														class="px-1.5 py-0.5 rounded-xl bg-gray-100 dark:bg-gray-850 text-xs"
													>
														<a
															href={'/admin/users/groups?id=' + userGroup.id}
															on:click|preventDefault={() =>
																goto('/admin/users/groups?id=' + userGroup.id)}
														>
															{userGroup.name}
														</a>
													</span>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Subscription Plan -->
									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Subscription Plan')}</div>

										<div class="flex-1">
											<select
												class="w-full dark:bg-gray-900 text-sm bg-transparent outline-hidden"
												bind:value={selectedPlanId}
												disabled={changingPlan || plansLoading}
												on:change={handleChangePlan}
											>
												<option value="">{$i18n.t('No plan')}</option>
												{#each availablePlans as plan}
													<option value={plan.id}>
														{plan.name_ru || plan.name}{plan.price > 0
															? ` (${plan.price} ${plan.currency})`
															: ''}
													</option>
												{/each}
											</select>
										</div>

										{#if subscriptionLoading}
											<div class="text-xs text-gray-400 mt-1">{$i18n.t('Loading...')}</div>
										{:else if userSubscription?.subscription}
											<div class="text-xs text-gray-500 mt-1">
												{$i18n.t('Status')}:
												<span
													class={userSubscription.subscription.status === 'active'
														? 'text-green-600 dark:text-green-400'
														: 'text-gray-500'}>{userSubscription.subscription.status}</span
												>
												{#if userSubscription.subscription.current_period_end}
													· {$i18n.t('until')}
													{dayjs(userSubscription.subscription.current_period_end * 1000).format(
														'LL'
													)}
												{/if}
											</div>
											<!-- Usage -->
											{#if userSubscription.usage && Object.keys(userSubscription.usage).length > 0}
												<div class="flex flex-col gap-1 mt-2">
													{#each Object.entries(userSubscription.usage) as [metric, data]}
														{#if data.limit}
															<div class="text-xs">
																<div class="flex justify-between mb-0.5">
																	<span class="text-gray-600 dark:text-gray-400"
																		>{metric.replace('_', ' ')}</span
																	>
																	<span
																		>{formatCompactNumber(data.used)} / {formatCompactNumber(
																			data.limit
																		)}</span
																	>
																</div>
																<div
																	class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
																>
																	<div
																		class="h-full {getUsageColor(
																			data.percentage || 0
																		)} transition-all"
																		style="width: {Math.min(100, data.percentage || 0)}%"
																	></div>
																</div>
															</div>
														{/if}
													{/each}
												</div>
											{/if}
										{/if}
									</div>

									{#if sessionUser?.role === 'admin'}
										<div
											class="flex flex-col w-full rounded-lg border border-gray-200 dark:border-gray-800 p-2"
										>
											<div class="mb-1 text-xs text-gray-500">{$i18n.t('Wallet')}</div>

											{#if walletLoading}
												<div class="text-xs text-gray-400">{$i18n.t('Loading...')}</div>
											{:else if walletSummary}
												<div class="grid grid-cols-2 gap-2 text-xs">
													<div class="rounded-md bg-gray-50 dark:bg-gray-850 px-2 py-1">
														<div class="text-gray-500">{$i18n.t('Topup balance')}</div>
														<div class="font-medium">
															{formatKopeksAmount(walletSummary.wallet.balance_topup_kopeks)}
															{` ${walletSummary.wallet.currency}`}
														</div>
													</div>
													<div class="rounded-md bg-gray-50 dark:bg-gray-850 px-2 py-1">
														<div class="text-gray-500">{$i18n.t('Included balance')}</div>
														<div class="font-medium">
															{formatKopeksAmount(walletSummary.wallet.balance_included_kopeks)}
															{` ${walletSummary.wallet.currency}`}
														</div>
													</div>
												</div>

												<div class="mt-1 text-[11px] text-gray-500">
													{$i18n.t('Spending order: included first, then topup')}
												</div>

												{#if walletSummary.ledger_preview.length > 0}
													<div class="mt-2 space-y-1">
														<div class="text-[11px] text-gray-500">
															{$i18n.t('Recent ledger entries')}
														</div>
														{#each walletSummary.ledger_preview.slice(0, 5) as entry}
															<div class="flex items-center justify-between text-[11px]">
																<div class="truncate text-gray-500">{$i18n.t(entry.type)}</div>
																<div
																	class={entry.amount_kopeks >= 0
																		? 'text-green-600 dark:text-green-400'
																		: 'text-red-600 dark:text-red-400'}
																>
																	{entry.amount_kopeks >= 0 ? '+' : ''}{formatKopeksAmount(
																		entry.amount_kopeks
																	)}
																</div>
															</div>
														{/each}
													</div>
												{/if}

												<div class="mt-2 grid grid-cols-2 gap-1.5">
													<div class="flex flex-col">
														<label for="wallet-delta-topup" class="mb-0.5 text-[11px] text-gray-500">
															{$i18n.t('Topup delta (RUB)')}
														</label>
														<input
															id="wallet-delta-topup"
															class="w-full text-sm bg-transparent outline-hidden border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1"
															type="text"
															inputmode="decimal"
															placeholder="0"
															bind:value={walletDeltaTopupRub}
															disabled={walletAdjusting || walletLoading}
														/>
													</div>
													<div class="flex flex-col">
														<label for="wallet-delta-included" class="mb-0.5 text-[11px] text-gray-500">
															{$i18n.t('Included delta (RUB)')}
														</label>
														<input
															id="wallet-delta-included"
															class="w-full text-sm bg-transparent outline-hidden border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1"
															type="text"
															inputmode="decimal"
															placeholder="0"
															bind:value={walletDeltaIncludedRub}
															disabled={walletAdjusting || walletLoading}
														/>
													</div>
												</div>

												<div class="mt-1 text-[11px] text-gray-500">
													{$i18n.t('Enter deltas in rubles (e.g. 1000,50). Use negative values to subtract.')}
												</div>

												<div class="mt-1.5 flex flex-col">
													<label for="wallet-adjust-reason" class="mb-0.5 text-[11px] text-gray-500"
														>{$i18n.t('Reason')}</label
													>
													<input
														id="wallet-adjust-reason"
														class="w-full text-sm bg-transparent outline-hidden border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1"
														type="text"
														bind:value={walletAdjustmentReason}
														placeholder={$i18n.t('Admin reason')}
														disabled={walletAdjusting || walletLoading}
													/>
												</div>

												<div class="mt-2 flex justify-end">
													<button
														class="px-2.5 py-1 text-xs font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full disabled:opacity-60"
														type="button"
														disabled={walletAdjusting || walletLoading}
														on:click|preventDefault={handleAdjustWallet}
													>
														{walletAdjusting
															? $i18n.t('Applying...')
															: $i18n.t('Apply wallet adjustment')}
													</button>
												</div>
											{:else}
												<div class="text-xs text-gray-400">{$i18n.t('Wallet data unavailable')}</div>
											{/if}
										</div>
									{/if}

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Role')}</div>

										<div class="flex-1">
											<select
												class="w-full dark:bg-gray-900 text-sm bg-transparent disabled:text-gray-500 dark:disabled:text-gray-500 outline-hidden"
												bind:value={_user.role}
												disabled={_user.id == sessionUser.id}
												required
											>
												<option value="admin">{$i18n.t('Admin')}</option>
												<option value="user">{$i18n.t('User')}</option>
												<option value="pending">{$i18n.t('Pending')}</option>
											</select>
										</div>
									</div>

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Name')}</div>

										<div class="flex-1">
											<input
												class="w-full text-sm bg-transparent outline-hidden"
												type="text"
												bind:value={_user.name}
												placeholder={$i18n.t('Enter Your Name')}
												autocomplete="off"
												required
											/>
										</div>
									</div>

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Email')}</div>

										<div class="flex-1">
											<input
												class="w-full text-sm bg-transparent disabled:text-gray-500 dark:disabled:text-gray-500 outline-hidden"
												type="email"
												bind:value={_user.email}
												placeholder={$i18n.t('Enter Your Email')}
												autocomplete="off"
												required
											/>
										</div>
									</div>

									{#if _user?.oauth}
										<div class="flex flex-col w-full">
											<div class=" mb-1 text-xs text-gray-500">{$i18n.t('OAuth ID')}</div>

											<div class="flex-1 text-sm break-all mb-1 flex flex-col space-y-1">
												{#each Object.keys(_user.oauth) as key}
													<div>
														<span class="text-gray-500">{key}</span>
														<span class="">{_user.oauth[key]?.sub}</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('New Password')}</div>

										<div class="flex-1">
											<SensitiveInput
												class="w-full text-sm bg-transparent outline-hidden"
												type="password"
												placeholder={$i18n.t('Enter New Password')}
												bind:value={_user.password}
												autocomplete="new-password"
												required={false}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div class="flex justify-end pt-3 text-sm font-medium">
							<button
								class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex flex-row space-x-1 items-center"
								type="submit"
							>
								{$i18n.t('Save')}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>

<style>
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		/* display: none; <- Crashes Chrome on hover */
		-webkit-appearance: none;
		margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
	}

	.tabs::-webkit-scrollbar {
		display: none; /* for Chrome, Safari and Opera */
	}

	.tabs {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	</style>

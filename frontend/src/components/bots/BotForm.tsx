import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAddress } from 'ethers';
import gsap from 'gsap';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { animateModalEnter, animateModalExit } from '../../lib/animations';
import { getLenis } from '../../lib/lenis';
import { WBNB_BSC, QUOTE_TOKENS } from '../../config/quoteTokens';
import { BaseTokenSelector } from './BaseTokenSelector';
import { QuoteTokenSelector } from './QuoteTokenSelector';
import { TradeSideToggle } from './TradeSideToggle';
import { TokenPriceDisplay } from './TokenPriceDisplay';
import { usePriceCheck } from '../../hooks/usePriceCheck';
import { DEX_OPTIONS } from '../../config/dexOptions';
import { useAuth } from '../../context/AuthContext';

const baseSchema = z.object({
  name: z.string().min(1),
  strategyType: z.enum(['smooth_buy', 'smooth_sell', 'volume_cycle']),
  dex: z.enum(['pancakeswap', 'uniswap']),
  dexVersion: z.enum(['v2', 'v3']),
  baseToken: z
    .string()
    .min(1, 'Select a token from your wallet')
    .refine(
      (v) => {
        try {
          getAddress(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid token address' }
    ),
  quoteToken: z
    .string()
    .min(1, 'Select a quote token')
    .refine(
      (v) => {
        try {
          getAddress(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid quote token address' }
    ),
  walletGroupId: z.string(),
  buyEnabled: z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean()),
  sellEnabled: z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean()),
  amountMin: z.string(),
  amountMax: z.string(),
  intervalSeconds: z.coerce.number().min(30),
  slippageBps: z.coerce.number().min(50).max(2000),
  maxDailyNotionalUSD: z.coerce.number().nonnegative(),
});

function buildSchema(tradeLimitUSD: number, isAdmin: boolean) {
  const maxDailySchema = isAdmin
    ? z.coerce.number().nonnegative()
    : z.coerce
        .number()
        .max(tradeLimitUSD, `Cannot exceed your approved limit ($${tradeLimitUSD.toFixed(2)})`)
        .min(tradeLimitUSD, `Must match your approved limit ($${tradeLimitUSD.toFixed(2)})`);

  return baseSchema.extend({ maxDailyNotionalUSD: maxDailySchema }).superRefine((data, ctx) => {
  if (data.baseToken && data.quoteToken && data.baseToken.toLowerCase() === data.quoteToken.toLowerCase()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Base and quote token cannot be the same',
      path: ['baseToken'],
    });
  }
  if (data.strategyType === 'volume_cycle') {
    if (!data.buyEnabled || !data.sellEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Volume cycle requires buy and sell enabled',
        path: ['buyEnabled'],
      });
    }
  } else if (!data.buyEnabled && !data.sellEnabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enable at least one trade direction',
      path: ['buyEnabled'],
    });
  }
  });
}

export type BotFormValues = z.infer<ReturnType<typeof buildSchema>>;

export function BotForm({
  groups,
  onSubmit,
  onClose,
  isSubmitting = false,
}: {
  groups: { id: string; name: string }[];
  onSubmit: (values: BotFormValues) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tradeLimitUSD = user?.tradeLimitUSD ?? 1;
  const isAdmin = user?.role === 'admin';
  const schema = useMemo(() => buildSchema(tradeLimitUSD, isAdmin), [tradeLimitUSD, isAdmin]);

  const [step, setStep] = useState(1);
  const [baseTokenMeta, setBaseTokenMeta] = useState<{ symbol: string; decimals: number }>({
    symbol: 'Token',
    decimals: 18,
  });
  const stepRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    trigger,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BotFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      strategyType: 'smooth_buy',
      dex: 'pancakeswap',
      dexVersion: 'v2',
      baseToken: '',
      quoteToken: WBNB_BSC,
      buyEnabled: true,
      sellEnabled: true,
      intervalSeconds: 60,
      slippageBps: 300,
      /** Small per-trade range (18-decimal quote); tune if your quote is not ~BNB-sized. */
      amountMin: '50000000000000',
      amountMax: '200000000000000',
      maxDailyNotionalUSD: tradeLimitUSD,
    },
  });

  useEffect(() => {
    if (!isAdmin) {
      setValue('maxDailyNotionalUSD', tradeLimitUSD, { shouldValidate: true });
    }
  }, [isAdmin, tradeLimitUSD, setValue]);

  const strategyType = watch('strategyType');
  const baseToken = watch('baseToken');
  const quoteToken = watch('quoteToken');
  const dex = watch('dex');
  const dexVersion = watch('dexVersion');

  const quoteTokenParam =
    quoteToken && quoteToken.toLowerCase() === WBNB_BSC.toLowerCase() ? 'NATIVE' : quoteToken;

  const quoteSymbol =
    QUOTE_TOKENS.find((t) => t.address.toLowerCase() === quoteToken.toLowerCase())?.symbol ?? 'Token';

  const priceCheck = usePriceCheck({
    baseToken,
    quoteTokenParam,
    dex,
    dexVersion,
    baseDecimals: baseTokenMeta.decimals,
    enabled: step === 2 && !!baseToken && !!quoteToken,
  });

  const priceSnippet =
    priceCheck.data?.listed && priceCheck.data.priceInQuote
      ? {
          priceInQuote: priceCheck.data.priceInQuote,
          priceInUsd: priceCheck.data.priceInUsd,
        }
      : null;

  useEffect(() => {
    if (strategyType === 'volume_cycle') {
      setValue('buyEnabled', true);
      setValue('sellEnabled', true);
    }
  }, [strategyType, setValue]);

  async function goToStep(nextStep: number): Promise<void> {
    if (nextStep === step) return;
    if (nextStep > step) {
      if (step === 1) {
        const ok = await trigger(['name', 'strategyType', 'dex', 'dexVersion', 'walletGroupId']);
        if (!ok) return;
      }
      if (step === 2) {
        const ok = await trigger(['baseToken', 'quoteToken', 'buyEnabled', 'sellEnabled']);
        if (!ok) return;
      }
    }
    if (!stepRef.current) {
      setStep(nextStep);
      return;
    }
    const direction = nextStep > step ? -30 : 30;
    gsap.to(stepRef.current, {
      opacity: 0,
      x: direction,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        setStep(nextStep);
        if (!stepRef.current) return;
        gsap.fromTo(
          stepRef.current,
          { opacity: 0, x: -direction },
          { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }
        );
      },
    });
  }

  function prevStep(): void {
    void goToStep(Math.max(1, step - 1));
  }

  useEffect(() => {
    const lenis = getLenis();
    lenis?.stop();
    if (overlayRef.current && panelRef.current) {
      animateModalEnter(overlayRef.current, panelRef.current);
    }
    return () => lenis?.start();
  }, []);

  function requestClose(): void {
    if (!overlayRef.current || !panelRef.current) {
      onClose();
      return;
    }
    animateModalExit(overlayRef.current, panelRef.current, onClose);
  }

  function goToLimitRequest(e: MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    e.stopPropagation();
    getLenis()?.start();
    onClose();
    navigate('/trader/limit');
  }

  return (
    <div ref={overlayRef} data-gsap className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={panelRef}
        data-gsap
        data-lenis-prevent-wheel
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-modal)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">Create New Bot</div>
            <div className="text-xs text-[var(--text-muted)]">Step {step} of 3</div>
          </div>
          <button
            type="button"
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            onClick={requestClose}
          >
            ✕
          </button>
        </div>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-1.5 rounded-full ${step >= item ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'}`}
            />
          ))}
        </div>
        <form
          className="grid gap-4 text-sm"
          onSubmit={handleSubmit(async (v) => {
            if (isSubmitting) return;
            await onSubmit(v);
          })}
        >
          <div ref={stepRef} data-gsap>
          {step === 1 && (
            <>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-4">
                <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Basic Settings</div>
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)]">Bot Name</label>
                    <Input placeholder="My Volume Bot" {...register('name')} />
                    {errors.name && <p className="text-xs text-[var(--danger)]">{errors.name.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--text-secondary)]">Strategy</label>
                      <select
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-2 text-[var(--text-primary)]"
                        {...register('strategyType')}
                      >
                        <option value="smooth_buy">smooth_buy</option>
                        <option value="smooth_sell">smooth_sell</option>
                        <option value="volume_cycle">volume_cycle</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)]">DEX / router</label>
                      <Controller
                        name="dex"
                        control={control}
                        render={({ field: dexField }) => (
                          <Controller
                            name="dexVersion"
                            control={control}
                            render={({ field: versionField }) => (
                              <select
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-2 text-[var(--text-primary)]"
                                value={`${dexField.value}:${versionField.value}`}
                                onChange={(e) => {
                                  const [d, v] = e.target.value.split(':') as [
                                    'pancakeswap' | 'uniswap',
                                    'v2' | 'v3',
                                  ];
                                  dexField.onChange(d);
                                  versionField.onChange(v);
                                }}
                              >
                                {DEX_OPTIONS.map((opt) => (
                                  <option
                                    key={`${opt.dex}:${opt.version}`}
                                    value={`${opt.dex}:${opt.version}`}
                                    title={opt.title}
                                  >
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          />
                        )}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)]">Wallet Group</label>
                    <select
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-2 text-[var(--text-primary)]"
                      {...register('walletGroupId')}
                    >
                      <option value="">Select…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-4">
              <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Trading Pair & Directions</div>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    Base token
                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text-muted)]">
                      (token you want to trade)
                    </span>
                  </label>
                  <Controller
                    name="baseToken"
                    control={control}
                    render={({ field }) => (
                      <BaseTokenSelector
                        value={field.value}
                        onChange={(address, symbol, _name, decimals) => {
                          field.onChange(getAddress(address));
                          setBaseTokenMeta({ symbol, decimals });
                        }}
                        error={errors.baseToken?.message}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    Quote token
                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text-muted)]">
                      (what you pay or receive)
                    </span>
                  </label>
                  <Controller
                    name="quoteToken"
                    control={control}
                    render={({ field }) => (
                      <QuoteTokenSelector
                        value={field.value}
                        onChange={(address) => {
                          field.onChange(getAddress(address));
                        }}
                        error={errors.quoteToken?.message}
                        priceSnippet={priceSnippet}
                      />
                    )}
                  />
                </div>

                <TokenPriceDisplay
                  className="mt-0"
                  loading={priceCheck.loading}
                  data={priceCheck.data}
                  error={priceCheck.error}
                  baseSymbol={baseTokenMeta.symbol}
                  quoteSymbol={quoteSymbol}
                  dex={dex ?? 'pancakeswap'}
                  dexVersion={dexVersion ?? 'v2'}
                  onRefresh={priceCheck.refetch}
                />

                <div>
                  <TradeSideToggle
                    buyEnabled={watch('buyEnabled')}
                    sellEnabled={watch('sellEnabled')}
                    onBuyChange={(v) => {
                      setValue('buyEnabled', v, { shouldValidate: true, shouldDirty: true });
                    }}
                    onSellChange={(v) => {
                      setValue('sellEnabled', v, { shouldValidate: true, shouldDirty: true });
                    }}
                    strategyType={strategyType}
                  />
                  {errors.buyEnabled?.message && (
                    <p className="mt-1 text-xs text-[var(--danger)]">{errors.buyEnabled.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-depth)] p-4">
              <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">Risk Controls & Execution</div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
                {isAdmin ? (
                  <>
                    Set execution amounts and risk caps. Per-trade size is also capped by each trader&apos;s account limit
                    when they run bots.
                  </>
                ) : (
                  <>
                    Your max daily notional matches your account limit (
                    <span className="font-medium text-[var(--text-secondary)]">
                      ${tradeLimitUSD.toFixed(2)} USD
                    </span>
                    ). Adjust min/max wei below if your token uses different decimals.
                  </>
                )}
              </p>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)]">Amount Min (wei)</label>
                    <Input {...register('amountMin')} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)]">Amount Max (wei)</label>
                    <Input {...register('amountMax')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)]">Interval (seconds)</label>
                    <Input type="number" {...register('intervalSeconds', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)]">Slippage (bps)</label>
                    <Input type="number" {...register('slippageBps', { valueAsNumber: true })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Max Daily Notional (USD)</label>
                  {isAdmin ? (
                    <Input type="number" min={0} step={0.01} {...register('maxDailyNotionalUSD', { valueAsNumber: true })} />
                  ) : (
                    <>
                      <Input
                        type="number"
                        readOnly
                        tabIndex={-1}
                        className="cursor-not-allowed bg-[var(--bg-depth)] opacity-90"
                        {...register('maxDailyNotionalUSD', { valueAsNumber: true })}
                      />
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                        Set by admin — not editable on this screen.
                      </p>
                      <div className="mt-3 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand-bg)] p-3">
                        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                          Need a higher limit? Send a request to your admin for approval before you can raise this
                          cap.
                        </p>
                        <Button
                          type="button"
                          className="mt-3 w-full gap-2 bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                          onClick={(e) => goToLimitRequest(e)}
                        >
                          <Shield className="h-4 w-4" />
                          Request limit increase from admin
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                  {errors.maxDailyNotionalUSD?.message && (
                    <p className="mt-1 text-xs text-[var(--danger)]">{errors.maxDailyNotionalUSD.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1}>
              Back
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                onClick={() => void goToStep(Math.min(3, step + 1))}
              >
                Continue
              </Button>
            ) : (
            <Button
              type="submit"
              className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create Draft Bot'}
            </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

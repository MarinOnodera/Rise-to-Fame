# Rise to Fame — K-Pop Producer & Fan (Prototype)

K-Pop カルチャーをテーマに、**プロデューサー側**と**ファン側**を一つのアプリで
体験できるゲームのプロトタイプです。Next.js 15 (App Router) + TypeScript +
Tailwind + Zustand で構築しています。

## 動かし方

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。モバイル幅 (max-w-md) を想定した
レイアウトです。

## 入ってからの順序

1. アプリ（このWebアプリ）を開く
2. ニックネーム入力（英数字＋記号1個以上、8〜12文字、重複NG）
3. トップ画面 → 「ゲームスタート」
4. デフォルトは**ファン側**。ホーム上部から
   「アイドルグループを作成する」ボタンで**プロデューサー側**へいつでも切替可能。

## 実装済みの主要機能

### 共通
- ニックネーム登録（バリデーション / ローカル重複チェック）
- 登録ボーナス **♦500 コイン**
- 連続ログインボーナス（streak に応じて増加）
- コイン購入画面（実決済は**模擬**。本番は Apple/Google IAP / Stripe）
- 街の広告 (idol / cat / dog / actress / variety のミックス)
- 運営デフォルトの 5 グループ（ガールズ3・ボーイズ2、うち 2 を dominant）

### ファン側
- グループ一覧、ガールズ／ボーイズ、新人（ルーキー）
- 推しグループ **最大3**、推しアイドル **最大5**
- グッズ / コンサートチケット購入
- 推しアイドルから**毎日1通**届くメッセージ（`lib/personality.ts` に性格別テンプレ）

### プロデューサー側
- 事務所設立（代表兼プロデューサー）
- オーディション / スカウト（スカウトはレア寄り・高額）
- ロスター → 個別トレーニング（hardworking +1 / lazy -1）
- マーケティング: 路上ライブ / SNS / 駅広告 / ビルボード / バラエティ / MV
- グループ結成 → デビュー（ファン側で「売れない頃から応援」可能に）
- ファイナンス: アプリ内銀行 / 投資家からの借入、返済
- 銀行口座の登録 UI（還元振込先。実際の振込はダミー）
- ファン課金の **20%** を事務所に還元（累積 `payoutEarnedJpy` で表示）

### AI 性格（倫理フィルタ）
- `lib/personality.ts` の `rollPersonality` で努力家を多めに生成。`lazy` も少数混ぜる。
- `ETHICAL_BLOCKLIST` に psychopath / sociopath / cruel / manipulative / violent を定義。
  将来 LLM に接続する場合も、この blocklist をシステムプロンプトに含めて遵守させる想定。

### 顔の一意性
- `lib/idols/generator.ts` が `FaceSeed` を生成し、`USED_FACE_KEYS` で重複を排除。
- UI は `components/IdolFace.tsx` の SVG で決定論的に描画。**本番は画像生成API
  (K-Pop Demon Hunters 風の拡散モデル等) に差し替え可能**。

## 本番化に必要な追加作業（プロトタイプでは未実装）

| 機能 | 推奨実装 |
|---|---|
| 実課金 | Apple IAP / Google Billing / Stripe |
| 銀行振込 | Stripe Connect / GMO Aozora / KYC (eKYC) |
| ニックネーム重複チェック | サーバー側で UNIQUE 制約 (Postgres 等) |
| 推しアイドルからのAI生成メッセージ | Claude API (`claude-sonnet-4-6` 等) + 性格＋倫理プロンプト |
| 画像生成（K-Pop Demon Hunters 画質） | 拡散モデル API (Imagen / SDXL / Midjourney) + 顔シード固定 |
| マルチユーザー | Supabase / Firebase / 独自API |
| プッシュ通知（推しメッセの「毎日配信」） | FCM / APNs + cron ワーカー |

## ディレクトリ

```
app/                  画面（App Router）
  page.tsx            スプラッシュ / ニックネーム登録
  home/               トップ（街と広告、推しハブ）
  fan/                ファン側（group/[id], messages, shop）
  producer/           プロデューサー側（audition, scout, roster, marketing, finance, debut）
  shop/coins/         コイン購入
components/           IdolFace / IdolCard / GroupCard / CityAds / TopBar / CoinBadge
lib/
  types.ts            ドメイン型
  rng.ts              決定論的 RNG
  personality.ts      性格 & 倫理フィルタ & 日次メッセージ
  economy.ts          価格 / 融資 / 還元率
  store.ts            Zustand + localStorage
  idols/generator.ts  アイドル & オーディション候補生成
  idols/defaults.ts   運営デフォルト 5 グループ & 街の広告
```

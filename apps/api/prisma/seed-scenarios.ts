import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// HTMLタグを除去
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<wbr\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&rarr;/g, '→')
    .replace(/&hArr;/g, '⇔')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function main() {
  console.log('既存のシナリオノードを削除...');
  await prisma.scenarioNode.deleteMany();

  console.log('受講者用シナリオを作成...');

  // ==================== 受講者用シナリオ ====================
  // 初期メッセージはシステムで設定（ルートレベル）

  // レベル1: メイン選択肢（5つ）
  const loginNode = await prisma.scenarioNode.create({
    data: {
      level: 1,
      triggerText: 'ログインできない',
      responseText: stripHtml(`下記の内容に注意し、ログインID・パスワードを確認してください。

■ログインID、パスワードは間違っていないですか？
■大文字、小文字、は合ってますか？
■空白が入ってはいませんか？

【よくある入力の間違え】小文字の(l)エル、大文字の(I)アイ

また、ログインID・パスワードに関しては派遣会社様が管理されていますので、派遣会社様にお尋ねください。`),
      order: 0,
    },
  });

  const courseNode = await prisma.scenarioNode.create({
    data: {
      level: 1,
      triggerText: '講座が見れない',
      responseText: 'どちらの内容にあてはまりますか？',
      order: 1,
    },
  });

  const completionNode = await prisma.scenarioNode.create({
    data: {
      level: 1,
      triggerText: '受講後、修了にならない',
      responseText: stripHtml(`★スライドのみの講座の場合
スライドのみの講座の場合、スライドを最後までみたら、アナウンスが出てくるのでそれに従って進んでください。

★動画の講座の場合
動画の場合は、最後まで視聴すると自動的に修了になります。
テストがある場合は、テストに合格すると修了になります。`),
      order: 2,
    },
  });

  const expiredNode = await prisma.scenarioNode.create({
    data: {
      level: 1,
      triggerText: '「ログイン有効期間外です」のメッセージがでる',
      responseText: '期間に関しては派遣会社様が管理されていますので、派遣会社様にお尋ねください。',
      order: 3,
    },
  });

  const otherNode = await prisma.scenarioNode.create({
    data: {
      level: 1,
      triggerText: 'その他の質問はこちら',
      responseText: '該当する質問がありましたら、ボタンを押してください。\n\nまた、該当する質問がない場合は、お気軽にチャットオペレーターにおつなぎください。',
      order: 4,
    },
  });

  // ==================== ログインできない > サブ選択肢 ====================
  await prisma.scenarioNode.create({
    data: {
      parentId: loginNode.id,
      level: 2,
      triggerText: '解決した',
      responseText: '解決して、良かったです♪\nまたお困りごとがありましたら、こちらのチャットをご利用ください。',
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: loginNode.id,
      level: 2,
      triggerText: 'パスワードを忘れた',
      responseText: 'パスワードをお忘れの場合は、派遣会社様にお問い合わせください。\nログインID・パスワードは派遣会社様が管理されています。',
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: loginNode.id,
      level: 2,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 2,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: loginNode.id,
      level: 2,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 3,
    },
  });

  // ==================== 講座が見れない > サブ選択肢 ====================
  const videoNode = await prisma.scenarioNode.create({
    data: {
      parentId: courseNode.id,
      level: 2,
      triggerText: '動画が再生できない',
      responseText: 'ご利用の端末はどちらですか？\n下のボタンからお選びください。',
      order: 0,
    },
  });

  const messageNode = await prisma.scenarioNode.create({
    data: {
      parentId: courseNode.id,
      level: 2,
      triggerText: 'メッセージが表示される',
      responseText: stripHtml(`現在のログイン環境では、講座が正常に受講できなくなっております。
下記推奨ブラウザで再度ログインして受講をお願いいたします。

iPhoneの場合：Safari（iPadも同様）
Androidの場合：Google Chrome`),
      order: 1,
    },
  });

  // 動画が再生できない > 端末選択
  const androidNode = await prisma.scenarioNode.create({
    data: {
      parentId: videoNode.id,
      level: 3,
      triggerText: 'Androidをご利用の方',
      responseText: stripHtml(`ブラウザは「Google Chrome」を推奨しています。
違うブラウザでサイトを見ている場合はGoogle Chromeに切り替えてからサイトにアクセスしてみてください。

それでも見れない場合は、下記の内容をお試しください。

★Chromeの設定の「閲覧履歴データの削除」から「キャッシュされた画像とファイル」にチェックを入れ削除
★端末を再起動`),
      order: 0,
    },
  });

  const iphoneNode = await prisma.scenarioNode.create({
    data: {
      parentId: videoNode.id,
      level: 3,
      triggerText: 'iPhoneをご利用の方',
      responseText: stripHtml(`ブラウザは「Safari」を推奨しています。

違うブラウザでサイトを見ている場合はSafariに切り替えてからサイトにアクセスしてみてください。

さらにそれでも見れない場合は、Wi-Fi接続を一度切り、接続直してみてください

メモリ不足になっている可能性があります。Safariのタブで開いている画面を全て閉じ、端末を再起動してください。`),
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: videoNode.id,
      level: 3,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 2,
    },
  });

  // Android > サブ選択肢
  await prisma.scenarioNode.create({
    data: {
      parentId: androidNode.id,
      level: 4,
      triggerText: '解決した',
      responseText: '解決して、良かったです♪\nまたお困りごとがありましたら、こちらのチャットをご利用ください。',
      order: 0,
    },
  });

  const androidBlackNode = await prisma.scenarioNode.create({
    data: {
      parentId: androidNode.id,
      level: 4,
      triggerText: '画面が真っ黒、または真っ白になる',
      responseText: stripHtml(`「Wi-Fiの接続が不安定」「ブラウザでキャッシュが強く残る」場合、事象が発生した際には以下の対応を順にお試しください。

【1】Wi-Fi⇔LTEの切替を実施
Wi-Fiで接続されている場合は、Wi-Fiの通信が不安定な可能性があります。4G（LTE）に切り替えてご利用ください。
また、4G（LTE）で接続されている場合は、4G（LTE）の通信が不安定な可能性があります。
Wi-Fiに切り替えてご利用ください。

【2】ブラウザのキャッシュクリアを実施
別のご案内で添付したお手順でブラウザのキャッシュクリアを実施してください。`),
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: androidNode.id,
      level: 4,
      triggerText: '受講途中でエラーメッセージがでる',
      responseText: 'でているエラーメッセージをオペレーターにお知らせください。',
      order: 2,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: androidNode.id,
      level: 4,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 3,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: androidNode.id,
      level: 4,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 4,
    },
  });

  // Android画面真っ黒 > サブ選択肢
  await prisma.scenarioNode.create({
    data: {
      parentId: androidBlackNode.id,
      level: 5,
      triggerText: '解決した',
      responseText: '解決して、良かったです♪\nまたお困りごとがありましたら、こちらのチャットをご利用ください。',
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: androidBlackNode.id,
      level: 5,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: androidBlackNode.id,
      level: 5,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 2,
    },
  });

  // iPhone > サブ選択肢
  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneNode.id,
      level: 4,
      triggerText: '解決した',
      responseText: '解決して、良かったです♪\nまたお困りごとがありましたら、こちらのチャットをご利用ください。',
      order: 0,
    },
  });

  const iphoneBlackNode = await prisma.scenarioNode.create({
    data: {
      parentId: iphoneNode.id,
      level: 4,
      triggerText: '画面が真っ黒、または真っ白になる',
      responseText: stripHtml(`「Wi-Fiの接続が不安定」「ブラウザでキャッシュが強く残る」場合、事象が発生した際には以下の対応を順にお試しください。

【1】Wi-Fi⇔LTEの切替を実施
Wi-Fiで接続されている場合は、Wi-Fiの通信が不安定な可能性があります。4G（LTE）に切り替えてご利用ください。
また、4G（LTE）で接続されている場合は、4G（LTE）の通信が不安定な可能性があります。
Wi-Fiに切り替えてご利用ください。

【2】ブラウザのキャッシュクリアを実施
別のご案内で添付したお手順でブラウザのキャッシュクリアを実施してください。`),
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneNode.id,
      level: 4,
      triggerText: '受講途中でエラーメッセージがでる',
      responseText: 'でているエラーメッセージをオペレーターにお知らせください。',
      order: 2,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneNode.id,
      level: 4,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 3,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneNode.id,
      level: 4,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 4,
    },
  });

  // iPhone画面真っ黒 > サブ選択肢
  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneBlackNode.id,
      level: 5,
      triggerText: '解決した',
      responseText: '解決して、良かったです♪\nまたお困りごとがありましたら、こちらのチャットをご利用ください。',
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneBlackNode.id,
      level: 5,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: iphoneBlackNode.id,
      level: 5,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 2,
    },
  });

  // メッセージが表示される > サブ選択肢
  await prisma.scenarioNode.create({
    data: {
      parentId: messageNode.id,
      level: 3,
      triggerText: 'Androidをご利用の方',
      responseText: stripHtml(`ブラウザは「Google Chrome」を推奨しています。
Google Chromeに切り替えてからサイトにアクセスしてみてください。`),
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: messageNode.id,
      level: 3,
      triggerText: 'iPhoneをご利用の方',
      responseText: stripHtml(`ブラウザは「Safari」を推奨しています。
Safariに切り替えてからサイトにアクセスしてみてください。`),
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: messageNode.id,
      level: 3,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 2,
    },
  });

  // ==================== 修了にならない > サブ選択肢 ====================
  await prisma.scenarioNode.create({
    data: {
      parentId: completionNode.id,
      level: 2,
      triggerText: 'まだ解決しない',
      responseText: stripHtml(`サイトの更新をしていただけますでしょうか。
キーボードのF5キーを押すか、または画面左上の丸い矢印のようなマークを押していただくとページの再読込ができますのでお試しください。`),
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: completionNode.id,
      level: 2,
      triggerText: '解決した',
      responseText: '解決して、良かったです♪\nまたお困りごとがありましたら、こちらのチャットをご利用ください。',
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: completionNode.id,
      level: 2,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 2,
    },
  });

  // ==================== 有効期間外 > サブ選択肢 ====================
  await prisma.scenarioNode.create({
    data: {
      parentId: expiredNode.id,
      level: 2,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: expiredNode.id,
      level: 2,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 1,
    },
  });

  // ==================== その他の質問 > サブ選択肢 ====================
  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: 'プロフィールを変更したい',
      responseText: '画面右上のお名前部分をクリックすると、「プロフィールを変更」が表示されます。',
      order: 0,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: '文字の大きさを変更したい',
      responseText: stripHtml(`受講内容部分の表記は、画面構成が崩れることを防ぐために文字の大きさを固定しております。

文字の大きさを変更したい場合は、ブラウザにて以下の設定を行ってください。`),
      order: 1,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: '標準学習時間と、受講期間は違うのですか？',
      responseText: stripHtml(`標準学習時間は、その講座をひととおり終わらせるまでに必要な学習時間の目安です。
受講中も、講座内の画面で確認することができます。

受講期間は、その講座にアクセスし、学習できる期間を指します。
この期間を過ぎると講座にアクセスできなくなります。`),
      order: 2,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: '受講内容の保存や印刷はできますか。',
      responseText: '講座内容の保存や印刷につきましては、機能としてご提供しておりません。\n\nご利用のブラウザ、プリンタの印刷機能などで対応をお願いいたします。',
      order: 3,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: '受講途中でエラーが発生する',
      responseText: stripHtml(`受講を中断しても、中断したページから再開できます。
ただしテストの解答途中に中断してログアウトすると、入力内容は保存されず消えてしまいますのでご注意ください。

なお、ネットワークの問題で一時的にエラーが発生する場合もありますので、ブラウザの更新や再起動もお試しください。`),
      order: 4,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: '受講時間表示の赤字は何か？',
      responseText: '標準時間の4割以下の時間で受講している場合に、赤字で表示されます。',
      order: 5,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
      responseText: 'お困りごとを下のご入力欄にご記入ください。オペレーターが対応します。（日本語のみ対応可能）',
      action: 'HANDOVER',
      order: 6,
    },
  });

  await prisma.scenarioNode.create({
    data: {
      parentId: otherNode.id,
      level: 2,
      triggerText: 'はじめに戻る',
      responseText: '',
      action: 'RESTART',
      order: 7,
    },
  });

  const count = await prisma.scenarioNode.count();
  console.log(`受講者用シナリオ作成完了: ${count}ノード`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

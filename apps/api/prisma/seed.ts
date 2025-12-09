import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// siteId生成関数
function generateSiteId(): string {
  return `site_${crypto.randomBytes(16).toString('hex')}`;
}

async function main() {
  // ==================== デフォルトアプリケーション作成 ====================
  let defaultApp = await prisma.application.findFirst({
    where: { name: 'CrossLearning' },
  });

  if (!defaultApp) {
    defaultApp = await prisma.application.create({
      data: {
        name: 'CrossLearning',
        siteId: generateSiteId(),
        domain: 'cross-learning.net',
        description: 'クロスラーニング e-ラーニングサポート',
        isActive: true,
        settings: {
          headerTitle: 'クロスラーニング サポート',
          headerColor: '#F5A623',
          primaryColor: '#F5A623',
        },
      },
    });
    console.log('Created default application:', defaultApp.name, '(siteId:', defaultApp.siteId, ')');
  } else {
    console.log('Default application already exists:', defaultApp.name);
  }

  // 既存データをデフォルトアプリケーションに紐付け
  await prisma.user.updateMany({
    where: { applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  console.log('Updated users with default applicationId');

  await prisma.conversation.updateMany({
    where: { applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  console.log('Updated conversations with default applicationId');

  await prisma.scenario.updateMany({
    where: { applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  console.log('Updated scenarios with default applicationId');

  await prisma.template.updateMany({
    where: { applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  console.log('Updated templates with default applicationId');

  await prisma.chatSettings.updateMany({
    where: { applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  console.log('Updated chatSettings with default applicationId');

  await prisma.notificationConfig.updateMany({
    where: { applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  console.log('Updated notificationConfigs with default applicationId');

  // ==================== 初期管理者ユーザーを作成 ====================
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@cross-learning.net' },
    update: {},
    create: {
      email: 'admin@cross-learning.net',
      passwordHash: hashedPassword,
      name: '管理者',
      role: 'SUPER_ADMIN',
      status: 'ONLINE',
    },
  });

  console.log('Created admin user:', admin.email);

  // 管理者をデフォルトアプリに紐付け
  await prisma.adminApplicationAccess.upsert({
    where: {
      adminId_applicationId: {
        adminId: admin.id,
        applicationId: defaultApp.id,
      },
    },
    update: {},
    create: {
      adminId: admin.id,
      applicationId: defaultApp.id,
      role: 'owner',
    },
  });
  console.log('Linked admin to default application');

  // 応答テンプレートを作成
  const templates = [
    {
      code: 'crosslink01',
      name: 'オペレーター接続挨拶',
      content: 'お待たせいたしました。e-ラーニングサポートでございます。\nお尋ねのことは何でしょうか？',
      category: '挨拶',
      order: 1,
    },
    {
      code: 'crosslink02',
      name: '終了挨拶',
      content: 'ご利用ありがとうございました。',
      category: '挨拶',
      order: 2,
    },
    {
      code: 'crosslink03',
      name: 'ログイン有効期限案内',
      content: 'かしこまりました。このメッセージが表示される場合はログイン有効期間の変更をする必要がございます。こちらから管理者様にログイン期間変更の旨をお伝えしますので、ログインIDをお教えいただけますか？',
      category: 'ログイン',
      order: 3,
    },
    {
      code: 'crosslink04',
      name: 'ログインID確認後',
      content: 'ありがとうございます。管理者様にお伝えしますので、お返事をお待ちください。',
      category: 'ログイン',
      order: 4,
    },
    {
      code: 'crosslink05',
      name: '管理者連絡',
      content: '管理者様へお伝えいたしました。ご連絡をお待ちください。有人チャットは一旦終了させていただきます。',
      category: '管理者',
      order: 5,
    },
    {
      code: 'crosslink06',
      name: '更新案内',
      content: '最後まで見ても「終了」にならない場合、サイトの更新をしていただけますでしょうか。\nキーボードのF5キーまたは画面左上の丸い矢印のようなマークを押していただくとページの再読込ができますので、お試し頂けますか。',
      category: '操作',
      order: 6,
    },
    {
      code: 'crosslink07',
      name: '有人チャット終了',
      content: '有人チャットを終了させていただきます。ご利用ありがとうございました。',
      category: '終了',
      order: 7,
    },
    {
      code: 'crosslink08',
      name: 'エラーメッセージ確認',
      content: 'ログインの際、何かエラーメッセージは表示されましたでしょうか？',
      category: 'ログイン',
      order: 8,
    },
    {
      code: 'crosslink09',
      name: '推奨ブラウザ案内',
      content: 'ご利用の端末によって推奨ブラウザが異なります。推奨しているブラウザでお試しいただけますでしょうか、お願いいたします。\n① 「android」の場合「GoogleChrome」\n② 「iPhone」の場合「safari」',
      category: '操作',
      order: 9,
    },
    {
      code: 'crosslink10',
      name: '受付終了',
      content: '有人チャットの受付終了のお時間となりましたので、有人チャットを終了させていただきます。ご利用ありがとうございました。',
      category: '終了',
      order: 10,
    },
    {
      code: 'crosslink11',
      name: 'システム調査',
      content: 'システムで調査し、改めてご連絡させていただきます。\nお忙しいところ申し訳ございませんが、よろしくお願いいたします。',
      category: 'システム',
      order: 11,
    },
  ];

  for (const template of templates) {
    await prisma.template.upsert({
      where: { code: template.code },
      update: template,
      create: template,
    });
  }
  console.log('Created/Updated templates:', templates.length);

  // EVA風シナリオを作成
  const existingNodes = await prisma.scenarioNode.count();
  if (existingNodes === 0) {
    // 初期メッセージ（ルートノードは暗黙的）

    // レベル1: メイン選択肢
    const loginNode = await prisma.scenarioNode.create({
      data: {
        level: 1,
        triggerText: 'ログインできない',
        responseText: '下記の内容を注意し、ログインID・パスワードを確認してください。\n\n■ログインID、パスワードは間違っていないですか？\n■大文字、小文字、は合ってますか？\n■空白が入ってはいませんか？\n\n【よくある入力の間違え】小文字の(l)エル、大文字の(I)アイ',
        order: 0,
      },
    });

    const courseNode = await prisma.scenarioNode.create({
      data: {
        level: 1,
        triggerText: '講座が見れない',
        responseText: '講座が見れない場合、いくつかの原因が考えられます。下記からお選びください。',
        order: 1,
      },
    });

    const completionNode = await prisma.scenarioNode.create({
      data: {
        level: 1,
        triggerText: '受講後、修了にならない',
        responseText: '受講後に修了にならない場合、以下の点をご確認ください。\n\n1. 講座を最後まで視聴しましたか？\n2. 確認テストがある場合、合格していますか？\n3. ブラウザの更新（F5キー）をお試しください。',
        order: 2,
      },
    });

    const expiredNode = await prisma.scenarioNode.create({
      data: {
        level: 1,
        triggerText: '「ログイン有効期間外です」のメッセージがでる',
        responseText: 'このメッセージが表示される場合、ログイン有効期間が終了している可能性があります。\n管理者様または派遣会社様にお問い合わせください。',
        order: 3,
      },
    });

    const otherNode = await prisma.scenarioNode.create({
      data: {
        level: 1,
        triggerText: 'その他の質問はこちら',
        responseText: 'その他のご質問についてお答えします。下記からお選びいただくか、オペレーターにおつなぎします。',
        order: 4,
      },
    });

    // ログインできない > サブ選択肢
    await prisma.scenarioNode.create({
      data: {
        parentId: loginNode.id,
        level: 2,
        triggerText: '解決した',
        responseText: '解決してよかったです。他にご不明な点がございましたら、お気軽にお尋ねください。',
        order: 0,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: loginNode.id,
        level: 2,
        triggerText: 'パスワードを忘れた',
        responseText: 'パスワードをお忘れの場合は、派遣会社様にお問い合わせください。\nパスワードは派遣会社様が管理されています。',
        action: 'LINK',
        actionValue: '',
        order: 1,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: loginNode.id,
        level: 2,
        triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
        responseText: '担当者にお繋ぎします。ご質問内容を送信後、少々お待ちください。\n（日本語のみ対応可能です）',
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

    // 講座が見れない > サブ選択肢
    await prisma.scenarioNode.create({
      data: {
        parentId: courseNode.id,
        level: 2,
        triggerText: '動画が再生できない',
        responseText: '動画が再生できない場合、以下をお試しください。\n\n1. インターネット接続を確認\n2. ブラウザを最新版に更新\n3. キャッシュをクリア\n4. 別のブラウザでお試し',
        order: 0,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: courseNode.id,
        level: 2,
        triggerText: 'メッセージが表示される',
        responseText: 'どのようなメッセージが表示されますか？\nエラーメッセージの内容をお教えください。',
        order: 1,
      },
    });

    // 受講後、修了にならない > サブ選択肢
    await prisma.scenarioNode.create({
      data: {
        parentId: completionNode.id,
        level: 2,
        triggerText: '解決した',
        responseText: '解決してよかったです。他にご不明な点がございましたら、お気軽にお尋ねください。',
        order: 0,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: completionNode.id,
        level: 2,
        triggerText: 'まだ解決しない',
        responseText: 'ご利用の端末をお教えください。',
        order: 1,
      },
    });

    // まだ解決しない > 端末選択
    const notSolvedNode = await prisma.scenarioNode.findFirst({
      where: { triggerText: 'まだ解決しない', parentId: completionNode.id },
    });

    if (notSolvedNode) {
      await prisma.scenarioNode.create({
        data: {
          parentId: notSolvedNode.id,
          level: 3,
          triggerText: 'iPhoneからご利用の方',
          responseText: 'iPhoneをご利用の場合、Safariブラウザでの視聴を推奨しております。\n設定 > Safari > 履歴とWebサイトデータを消去 をお試しください。',
          order: 0,
        },
      });

      await prisma.scenarioNode.create({
        data: {
          parentId: notSolvedNode.id,
          level: 3,
          triggerText: 'Androidからご利用の方',
          responseText: 'Androidをご利用の場合、Google Chromeブラウザでの視聴を推奨しております。\nChromeの設定からキャッシュクリアをお試しください。',
          order: 1,
        },
      });

      await prisma.scenarioNode.create({
        data: {
          parentId: notSolvedNode.id,
          level: 3,
          triggerText: 'PCからご利用の方',
          responseText: 'PCをご利用の場合、Google ChromeまたはMicrosoft Edgeでの視聴を推奨しております。\nブラウザのキャッシュクリア、またはシークレットモードでお試しください。',
          order: 2,
        },
      });

      await prisma.scenarioNode.create({
        data: {
          parentId: notSolvedNode.id,
          level: 3,
          triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
          responseText: '担当者にお繋ぎします。ご質問内容を送信後、少々お待ちください。\n（日本語のみ対応可能です）',
          action: 'HANDOVER',
          order: 3,
        },
      });

      await prisma.scenarioNode.create({
        data: {
          parentId: notSolvedNode.id,
          level: 3,
          triggerText: 'はじめに戻る',
          responseText: '',
          action: 'RESTART',
          order: 4,
        },
      });
    }

    // その他の質問 > サブ選択肢
    await prisma.scenarioNode.create({
      data: {
        parentId: otherNode.id,
        level: 2,
        triggerText: '受講時間表示の赤字は何？',
        responseText: '受講時間表示の赤字は「未修了」を示しています。\n講座を最後まで視聴すると黒字（修了）に変わります。',
        order: 0,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: otherNode.id,
        level: 2,
        triggerText: '受講内容の保存や印刷はできますか？',
        responseText: '申し訳ございませんが、講座内容の保存・印刷・ダウンロードはできません。\n著作権保護のため、オンラインでの視聴のみとなっております。',
        order: 1,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: otherNode.id,
        level: 2,
        triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
        responseText: '担当者にお繋ぎします。ご質問内容を送信後、少々お待ちください。\n（日本語のみ対応可能です）',
        action: 'HANDOVER',
        order: 2,
      },
    });

    await prisma.scenarioNode.create({
      data: {
        parentId: otherNode.id,
        level: 2,
        triggerText: 'はじめに戻る',
        responseText: '',
        action: 'RESTART',
        order: 3,
      },
    });

    // ログイン有効期間外 > サブ選択肢
    await prisma.scenarioNode.create({
      data: {
        parentId: expiredNode.id,
        level: 2,
        triggerText: 'オペレーターにつなぐ（日本語のみ対応可能）',
        responseText: '担当者にお繋ぎします。ご質問内容を送信後、少々お待ちください。\n（日本語のみ対応可能です）',
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

    console.log('Created EVA-style scenario nodes');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

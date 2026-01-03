/**
 * Test script to debug NeuronWriter scoring
 */

const testContent = `# 20代の貯金術：賢くお金を貯めるための完全ガイド

## はじめに

20代は人生の転換期であり、お金の管理を学ぶ絶好の機会です。この記事では、20代の貯金に関する基礎知識から実践的なテクニックまで、包括的に解説します。

## 20代の貯金の重要性

### なぜ今貯金を始めるべきか

20代で貯金を始めることは、将来の経済的な安定につながります。複利の効果を最大限に活用できる年齢であり、早く始めるほど有利です。

### 20代の平均貯金額

日本の20代の平均貯金額は約100万円と言われていますが、個人差が大きいのが実情です。

## 効果的な貯金方法

### 1. 先取り貯金

給料が入ったら、まず貯金分を別口座に移す「先取り貯金」が最も確実な方法です。

### 2. 固定費の見直し

スマホ代、保険料、サブスクリプションサービスなど、固定費を見直すことで月々の貯金額を増やせます。

### 3. 目標設定

具体的な貯金目標を設定することで、モチベーションを維持できます。

## 節約のコツ

- コンビニ利用を減らす
- 自炊を増やす
- ポイント活用
- セール時の購入

## まとめ

20代の貯金は、将来の自分への投資です。無理のない範囲で、継続的に貯金習慣を身につけることが重要です。`

const keyword = '20代 貯金'

async function testScoring() {
  console.log('Testing NeuronWriter scoring endpoint...\n')

  try {
    const response = await fetch('http://localhost:3002/api/writer/neuronwriter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'score',
        projectId: '25a33c27-5257-4b00-9e67-e6d9fb2a2390', // Habitto project ID
        conversationId: '7b1f6ec3-ada1-4211-957c-e8d601d54023', // Latest conversation ID
        keyword: keyword,
        content: testContent,
      }),
    })

    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error response:', errorText)
      return
    }

    const data = await response.json()
    console.log('\nScore response:')
    console.log('================')
    console.log('Final score:', data.score)
    console.log('NW API score:', data.nwScore)
    console.log('Local score:', data.localScore)
    console.log('\nAnalysis keywords count:', data.analysis?.topKeywords?.length || 0)

    if (data.localScore) {
      console.log('\nLocal score details:')
      console.log('- Percentage:', data.localScore.percentage)
      console.log('- Score:', data.localScore.score, '/', data.localScore.maxScore)
      console.log('- Missing terms:', data.localScore.missingTerms)
      console.log('- Suggestions:', data.localScore.suggestions)
    }

  } catch (error) {
    console.error('Test failed:', error)
  }
}

testScoring()

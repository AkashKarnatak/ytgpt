let youtubeApiKey, transcript

const $ = (x) => document.querySelector(x)

const waitForSelector = async (selector) => {
  return new Promise((resolve) => {
    if ($(selector)) {
      return resolve($(selector))
    }

    const observer = new MutationObserver(() => {
      if ($(selector)) {
        resolve($(selector))
        observer.disconnect()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  })
}

const createPopup = () => {
  if ($('.modal')) {
    $('.modal').style.display = 'flex'
    $('#modal-text p').innerText = ''
    return
  }
  const container = document.createElement('div')
  container.className = 'modal'
  const content = document.createElement('div')
  content.className = 'modal-content'
  const close = document.createElement('span')
  close.className = 'close'
  close.innerText = '×'
  close.onclick = () => {
    container.style.display = 'none'
  }
  window.onclick = (e) => {
    if (e.target == container) {
      container.style.display = 'none'
    }
  }
  const title = document.createElement('h2')
  title.id = 'modal-title'
  title.innerText = 'Summary'
  const textContainer = document.createElement('div')
  textContainer.id = 'modal-text'
  const p = document.createElement('p')
  textContainer.appendChild(p)
  content.appendChild(close)
  content.appendChild(title)
  content.appendChild(textContainer)
  container.appendChild(content)
  $('body').appendChild(container)
  container.style.display = 'flex'
}

const getYoutubeApiKey = () => {
  const scripts = document.getElementsByTagName('script')
  const script = Array.from(scripts).find((x) =>
    x.innerHTML.includes('INNERTUBE_API_KEY'),
  )
  youtubeApiKey = script.innerHTML
    .match(/"INNERTUBE_API_KEY"\s*:\s*"([^']+?)"/)
    .at(1)
  console.log(youtubeApiKey)
}

const getVideoTranscript = async (videoId) => {
  const res = await fetch(
    'https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.9999099' } },
        params: btoa(`\n\v${videoId}`),
      }),
    },
  )
  data = await res.json()
  return data?.actions
    ?.at(0)
    ?.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups?.map(
      (x) =>
        x.transcriptCueGroupRenderer.cues.at(0)?.transcriptCueRenderer?.cue
          .simpleText,
    )
    ?.join(' ')
}

const insertSummaryBtn = async () => {
  if ($('#summary-btn')) {
    return
  }
  const actionSelector = '#actions-inner ytd-menu-renderer'
  await waitForSelector(actionSelector)
  const actionDiv = $(actionSelector)
  const summaryBtn = document.createElement('button')
  summaryBtn.className = 'btn'
  summaryBtn.id = 'summary-btn'
  summaryBtn.innerText = 'Summary'
  actionDiv.prepend(summaryBtn)
  summaryBtn.onclick = () => {
    createPopup()
    if (!transcript) {
      const textAreaPara = $('#modal-text p')
      textAreaPara.innerText = 'Transcript not available for this video'
    }
    const conv = new OpenAIConversation({
      onMessage: (content) => {
        const textAreaPara = $('#modal-text p')
        console.log(content)
        textAreaPara.innerText = content
      },
      onError: (error) => {
        console.log('error received')
        const textAreaPara = $('#modal-text p')
        console.log(error)
        textAreaPara.innerText = error
      },
    })
    conv.ask(`Below is transcript of a youtube video

'''
${transcript}
'''

Summarize the contents of the video in bullet points`)
  }
}

const initialize = async () => {
  console.log('starting')
  await insertSummaryBtn()
  console.log('stopping')
  const videoId = new URL(document.location).searchParams.get('v')
  transcript = await getVideoTranscript(videoId)
  console.log(transcript)
}

;(async () => {
  await initialize()
  $('body').addEventListener('yt-navigate-finish', async () => {
    await initialize()
  })
})()

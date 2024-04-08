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

const getVideoTranscript = async (videoId, lang = 'en') => {
  try {
    const transcriptUrl = await parseTranscriptEndpoint(videoId, lang)
    console.log(transcriptUrl)

    if (!transcriptUrl)
      throw new Error("Failed to locate a transcript for this video!");

    const res = await fetch(transcriptUrl)
    const xmlText = await res.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

    let transcript = "";
    const chunks = xmlDoc.getElementsByTagName("text");
    for (const chunk of chunks) {
      transcript += chunk.textContent;
    }

    return transcript;
  } catch (e) {
    console.error(e)
  }
}

const parseTranscriptEndpoint = async (videoId, langCode='en') => {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`)
    const text = await res.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')
    // Get all script tags on document page
    const scripts = doc.getElementsByTagName("script");

    // find the player data script.
    const playerScript = Array.from(scripts).find((script) =>
      script.textContent.includes("var ytInitialPlayerResponse = {")
    );

    const dataString =
      playerScript.textContent
        ?.split("var ytInitialPlayerResponse = ")?.[1] //get the start of the object {....
        ?.split("};")?.[0] + // chunk off any code after object closure.
      "}"; // add back that curly brace we just cut.

    const data = JSON.parse(dataString.trim()); // Attempt a JSON parse
    const availableCaptions =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    // If languageCode was specified then search for it's code, otherwise get the first.
    let captionTrack = availableCaptions?.[0];
    if (langCode)
      captionTrack =
        availableCaptions.find((track) =>
          track.languageCode.includes(langCode)
        ) ?? availableCaptions?.[0];

    return captionTrack?.baseUrl;
  } catch (e) {
    console.error(`[parseTranscriptEndpoint] ${e.message}`);
    return null;
  }
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
  summaryBtn.onclick = async () => {
    createPopup()
    const videoId = new URL(document.location).searchParams.get('v')
    const transcript = await getVideoTranscript(videoId)
    console.log(transcript)
    if (!transcript) {
      const textAreaPara = $('#modal-text p')
      textAreaPara.innerText = 'Transcript not available for this video'
      return
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
}

;(async () => {
  await initialize()
  $('body').addEventListener('yt-navigate-finish', async () => {
    await initialize()
  })
})()

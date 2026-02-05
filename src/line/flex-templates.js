/**
 * LINE Flex Message template builders
 * @typedef {object} ListItem
 * @property {string} title
 * @param title
 * @param body
 * @param footer
 * @property {string} body
 * @property {string} [link]
 * @property {string} [imageUrl]
 * @typedef {object} CardAction
 * @property {string} label
 * @property {"message" | "uri" | "postback"} type
 * @property {string} [data]
 * @property {string} [uri]
 * @property {string} [text]
 */
function createInfoCard(title, body, footer) {
  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Title with accent bar
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [],
              width: '4px',
              backgroundColor: '#06C755',
              cornerRadius: '2px'
            },
            {
              type: 'text',
              text: title,
              weight: 'bold',
              size: 'xl',
              color: '#111111',
              wrap: true,
              flex: 1,
              margin: 'lg'
            }
          ]
        },
        // Body text in subtle container
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: body,
              size: 'md',
              color: '#444444',
              wrap: true,
              lineSpacing: '6px'
            }
          ],
          margin: 'xl',
          paddingAll: 'lg',
          backgroundColor: '#F8F9FA',
          cornerRadius: 'lg'
        }
      ],
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
  if (footer) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: footer,
          size: 'xs',
          color: '#AAAAAA',
          wrap: true,
          align: 'center'
        }
      ],
      paddingAll: 'lg',
      backgroundColor: '#FAFAFA'
    };
  }
  return bubble;
}
function createListCard(title, items) {
  const itemContents = items.slice(0, 8).map((item, index) => {
    const itemContents2 = [
      {
        type: 'text',
        text: item.title,
        size: 'md',
        weight: 'bold',
        color: '#1a1a1a',
        wrap: true
      }
    ];
    if (item.subtitle) {
      itemContents2.push({
        type: 'text',
        text: item.subtitle,
        size: 'sm',
        color: '#888888',
        wrap: true,
        margin: 'xs'
      });
    }
    const itemBox = {
      type: 'box',
      layout: 'horizontal',
      contents: [
        // Accent dot
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [],
              width: '8px',
              height: '8px',
              backgroundColor: index === 0 ? '#06C755' : '#DDDDDD',
              cornerRadius: '4px'
            }
          ],
          width: '20px',
          alignItems: 'center',
          paddingTop: 'sm'
        },
        // Item content
        {
          type: 'box',
          layout: 'vertical',
          contents: itemContents2,
          flex: 1
        }
      ],
      margin: index > 0 ? 'lg' : void 0
    };
    if (item.action) {
      itemBox.action = item.action;
    }
    return itemBox;
  });
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'xl',
          color: '#111111',
          wrap: true
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#EEEEEE'
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: itemContents,
          margin: 'lg'
        }
      ],
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
}
function createImageCard(imageUrl, title, body, options) {
  const bubble = {
    type: 'bubble',
    hero: {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: options?.aspectRatio ?? '20:13',
      aspectMode: options?.aspectMode ?? 'cover',
      action: options?.action
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'xl',
          wrap: true
        }
      ],
      paddingAll: 'lg'
    }
  };
  if (body && bubble.body) {
    bubble.body.contents.push({
      type: 'text',
      text: body,
      size: 'md',
      wrap: true,
      margin: 'md',
      color: '#666666'
    });
  }
  return bubble;
}
function createActionCard(title, body, actions, options) {
  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: title,
          weight: 'bold',
          size: 'xl',
          wrap: true
        },
        {
          type: 'text',
          text: body,
          size: 'md',
          wrap: true,
          margin: 'md',
          color: '#666666'
        }
      ],
      paddingAll: 'lg'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: actions.slice(0, 4).map(
        (action, index) => ({
          type: 'button',
          action: action.action,
          style: index === 0 ? 'primary' : 'secondary',
          margin: index > 0 ? 'sm' : void 0
        })
      ),
      paddingAll: 'md'
    }
  };
  if (options?.imageUrl) {
    bubble.hero = {
      type: 'image',
      url: options.imageUrl,
      size: 'full',
      aspectRatio: options.aspectRatio ?? '20:13',
      aspectMode: 'cover'
    };
  }
  return bubble;
}
function createCarousel(bubbles) {
  return {
    type: 'carousel',
    contents: bubbles.slice(0, 12)
  };
}
function createNotificationBubble(text, options) {
  const colors = {
    info: { accent: '#3B82F6', bg: '#EFF6FF' },
    success: { accent: '#06C755', bg: '#F0FDF4' },
    warning: { accent: '#F59E0B', bg: '#FFFBEB' },
    error: { accent: '#EF4444', bg: '#FEF2F2' }
  };
  const typeColors = colors[options?.type ?? 'info'];
  const contents = [];
  contents.push({
    type: 'box',
    layout: 'vertical',
    contents: [],
    width: '4px',
    backgroundColor: typeColors.accent,
    cornerRadius: '2px'
  });
  const textContents = [];
  if (options?.title) {
    textContents.push({
      type: 'text',
      text: options.title,
      size: 'md',
      weight: 'bold',
      color: '#111111',
      wrap: true
    });
  }
  textContents.push({
    type: 'text',
    text,
    size: options?.title ? 'sm' : 'md',
    color: options?.title ? '#666666' : '#333333',
    wrap: true,
    margin: options?.title ? 'sm' : void 0
  });
  contents.push({
    type: 'box',
    layout: 'vertical',
    contents: textContents,
    flex: 1,
    paddingStart: 'lg'
  });
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'horizontal',
      contents,
      paddingAll: 'xl',
      backgroundColor: typeColors.bg
    }
  };
}
function createReceiptCard(params) {
  const { title, subtitle, items, total, footer } = params;
  const itemRows = items.slice(0, 12).map(
    (item, index) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: item.name,
          size: 'sm',
          color: item.highlight ? '#111111' : '#666666',
          weight: item.highlight ? 'bold' : 'regular',
          flex: 3,
          wrap: true
        },
        {
          type: 'text',
          text: item.value,
          size: 'sm',
          color: item.highlight ? '#06C755' : '#333333',
          weight: item.highlight ? 'bold' : 'regular',
          flex: 2,
          align: 'end',
          wrap: true
        }
      ],
      paddingAll: 'md',
      backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
    })
  );
  const headerContents = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: 'xl',
      color: '#111111',
      wrap: true
    }
  ];
  if (subtitle) {
    headerContents.push({
      type: 'text',
      text: subtitle,
      size: 'sm',
      color: '#888888',
      margin: 'sm',
      wrap: true
    });
  }
  const bodyContents = [
    {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      paddingBottom: 'lg'
    },
    {
      type: 'separator',
      color: '#EEEEEE'
    },
    {
      type: 'box',
      layout: 'vertical',
      contents: itemRows,
      margin: 'md',
      cornerRadius: 'md',
      borderWidth: 'light',
      borderColor: '#EEEEEE'
    }
  ];
  if (total) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: total.label,
          size: 'lg',
          weight: 'bold',
          color: '#111111',
          flex: 2
        },
        {
          type: 'text',
          text: total.value,
          size: 'xl',
          weight: 'bold',
          color: '#06C755',
          flex: 2,
          align: 'end'
        }
      ],
      margin: 'xl',
      paddingAll: 'lg',
      backgroundColor: '#F0FDF4',
      cornerRadius: 'lg'
    });
  }
  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
  if (footer) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: footer,
          size: 'xs',
          color: '#AAAAAA',
          wrap: true,
          align: 'center'
        }
      ],
      paddingAll: 'lg',
      backgroundColor: '#FAFAFA'
    };
  }
  return bubble;
}
function createEventCard(params) {
  const { title, date, time, location, description, calendar, isAllDay, action } = params;
  const dateBlock = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: date.toUpperCase(),
        size: 'sm',
        weight: 'bold',
        color: '#06C755',
        wrap: true
      },
      {
        type: 'text',
        text: isAllDay ? 'ALL DAY' : time ?? '',
        size: 'xxl',
        weight: 'bold',
        color: '#111111',
        wrap: true,
        margin: 'xs'
      }
    ],
    paddingBottom: 'lg',
    borderWidth: 'none'
  };
  if (!time && !isAllDay) {
    dateBlock.contents = [
      {
        type: 'text',
        text: date,
        size: 'xl',
        weight: 'bold',
        color: '#111111',
        wrap: true
      }
    ];
  }
  const titleBlock = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        contents: [],
        width: '4px',
        backgroundColor: '#06C755',
        cornerRadius: '2px'
      },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: title,
            size: 'lg',
            weight: 'bold',
            color: '#1a1a1a',
            wrap: true
          },
          ...calendar ? [
            {
              type: 'text',
              text: calendar,
              size: 'xs',
              color: '#888888',
              margin: 'sm',
              wrap: true
            }
          ] : []
        ],
        flex: 1,
        paddingStart: 'lg'
      }
    ],
    paddingTop: 'lg',
    paddingBottom: 'lg',
    borderWidth: 'light',
    borderColor: '#EEEEEE'
  };
  const bodyContents = [dateBlock, titleBlock];
  const hasDetails = location || description;
  if (hasDetails) {
    const detailItems = [];
    if (location) {
      detailItems.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: '\u{1F4CD}',
            size: 'sm',
            flex: 0
          },
          {
            type: 'text',
            text: location,
            size: 'sm',
            color: '#444444',
            margin: 'md',
            flex: 1,
            wrap: true
          }
        ],
        alignItems: 'flex-start'
      });
    }
    if (description) {
      detailItems.push({
        type: 'text',
        text: description,
        size: 'sm',
        color: '#666666',
        wrap: true,
        margin: location ? 'lg' : 'none'
      });
    }
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      contents: detailItems,
      margin: 'lg',
      paddingAll: 'lg',
      backgroundColor: '#F8F9FA',
      cornerRadius: 'lg'
    });
  }
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF',
      action
    }
  };
}
function createAgendaCard(params) {
  const { title, subtitle, events, footer } = params;
  const headerContents = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: 'xl',
      color: '#111111',
      wrap: true
    }
  ];
  if (subtitle) {
    headerContents.push({
      type: 'text',
      text: subtitle,
      size: 'sm',
      color: '#888888',
      margin: 'sm',
      wrap: true
    });
  }
  const eventItems = events.slice(0, 6).map((event, index) => {
    const isActive = event.isNow || index === 0;
    const accentColor = isActive ? '#06C755' : '#E5E5E5';
    const timeColumn = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: event.time ?? '\u2014',
          size: 'sm',
          weight: isActive ? 'bold' : 'regular',
          color: isActive ? '#06C755' : '#666666',
          align: 'end',
          wrap: true
        }
      ],
      width: '65px',
      justifyContent: 'flex-start'
    };
    const dotColumn = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: [],
          width: '10px',
          height: '10px',
          backgroundColor: accentColor,
          cornerRadius: '5px'
        }
      ],
      width: '24px',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 'xs'
    };
    const detailContents = [
      {
        type: 'text',
        text: event.title,
        size: 'md',
        weight: 'bold',
        color: '#1a1a1a',
        wrap: true
      }
    ];
    const secondaryParts = [];
    if (event.location) {
      secondaryParts.push(event.location);
    }
    if (event.calendar) {
      secondaryParts.push(event.calendar);
    }
    if (secondaryParts.length > 0) {
      detailContents.push({
        type: 'text',
        text: secondaryParts.join(' \xB7 '),
        size: 'xs',
        color: '#888888',
        wrap: true,
        margin: 'xs'
      });
    }
    const detailColumn = {
      type: 'box',
      layout: 'vertical',
      contents: detailContents,
      flex: 1
    };
    return {
      type: 'box',
      layout: 'horizontal',
      contents: [timeColumn, dotColumn, detailColumn],
      margin: index > 0 ? 'xl' : void 0,
      alignItems: 'flex-start'
    };
  });
  const bodyContents = [
    {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      paddingBottom: 'lg'
    },
    {
      type: 'separator',
      color: '#EEEEEE'
    },
    {
      type: 'box',
      layout: 'vertical',
      contents: eventItems,
      paddingTop: 'xl'
    }
  ];
  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
  if (footer) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: footer,
          size: 'xs',
          color: '#AAAAAA',
          align: 'center',
          wrap: true
        }
      ],
      paddingAll: 'lg',
      backgroundColor: '#FAFAFA'
    };
  }
  return bubble;
}
function createMediaPlayerCard(params) {
  const { title, subtitle, source, imageUrl, isPlaying, progress, controls, extraActions } = params;
  const trackInfo = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: 'xl',
      color: '#111111',
      wrap: true
    }
  ];
  if (subtitle) {
    trackInfo.push({
      type: 'text',
      text: subtitle,
      size: 'md',
      color: '#666666',
      wrap: true,
      margin: 'sm'
    });
  }
  const statusItems = [];
  if (isPlaying !== void 0) {
    statusItems.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: [],
          width: '8px',
          height: '8px',
          backgroundColor: isPlaying ? '#06C755' : '#CCCCCC',
          cornerRadius: '4px'
        },
        {
          type: 'text',
          text: isPlaying ? 'Now Playing' : 'Paused',
          size: 'xs',
          color: isPlaying ? '#06C755' : '#888888',
          weight: 'bold',
          margin: 'sm'
        }
      ],
      alignItems: 'center'
    });
  }
  if (source) {
    statusItems.push({
      type: 'text',
      text: source,
      size: 'xs',
      color: '#AAAAAA',
      margin: statusItems.length > 0 ? 'lg' : void 0
    });
  }
  if (progress) {
    statusItems.push({
      type: 'text',
      text: progress,
      size: 'xs',
      color: '#888888',
      align: 'end',
      flex: 1
    });
  }
  const bodyContents = [
    {
      type: 'box',
      layout: 'vertical',
      contents: trackInfo
    }
  ];
  if (statusItems.length > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: statusItems,
      margin: 'lg',
      alignItems: 'center'
    });
  }
  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
  if (imageUrl) {
    bubble.hero = {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover'
    };
  }
  if (controls || extraActions?.length) {
    const footerContents = [];
    if (controls) {
      const controlButtons = [];
      if (controls.previous) {
        controlButtons.push({
          type: 'button',
          action: {
            type: 'postback',
            label: '\u23EE',
            data: controls.previous.data
          },
          style: 'secondary',
          flex: 1,
          height: 'sm'
        });
      }
      if (controls.play) {
        controlButtons.push({
          type: 'button',
          action: {
            type: 'postback',
            label: '\u25B6',
            data: controls.play.data
          },
          style: isPlaying ? 'secondary' : 'primary',
          flex: 1,
          height: 'sm',
          margin: controls.previous ? 'md' : void 0
        });
      }
      if (controls.pause) {
        controlButtons.push({
          type: 'button',
          action: {
            type: 'postback',
            label: '\u23F8',
            data: controls.pause.data
          },
          style: isPlaying ? 'primary' : 'secondary',
          flex: 1,
          height: 'sm',
          margin: controlButtons.length > 0 ? 'md' : void 0
        });
      }
      if (controls.next) {
        controlButtons.push({
          type: 'button',
          action: {
            type: 'postback',
            label: '\u23ED',
            data: controls.next.data
          },
          style: 'secondary',
          flex: 1,
          height: 'sm',
          margin: controlButtons.length > 0 ? 'md' : void 0
        });
      }
      if (controlButtons.length > 0) {
        footerContents.push({
          type: 'box',
          layout: 'horizontal',
          contents: controlButtons
        });
      }
    }
    if (extraActions?.length) {
      footerContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: extraActions.slice(0, 2).map(
          (action, index) => ({
            type: 'button',
            action: {
              type: 'postback',
              label: action.label.slice(0, 15),
              data: action.data
            },
            style: 'secondary',
            flex: 1,
            height: 'sm',
            margin: index > 0 ? 'md' : void 0
          })
        ),
        margin: 'md'
      });
    }
    if (footerContents.length > 0) {
      bubble.footer = {
        type: 'box',
        layout: 'vertical',
        contents: footerContents,
        paddingAll: 'lg',
        backgroundColor: '#FAFAFA'
      };
    }
  }
  return bubble;
}
function createAppleTvRemoteCard(params) {
  const { deviceName, status, actionData } = params;
  const headerContents = [
    {
      type: 'text',
      text: deviceName,
      weight: 'bold',
      size: 'xl',
      color: '#111111',
      wrap: true
    }
  ];
  if (status) {
    headerContents.push({
      type: 'text',
      text: status,
      size: 'sm',
      color: '#666666',
      wrap: true,
      margin: 'sm'
    });
  }
  const makeButton = (label, data, style = 'secondary') => ({
    type: 'button',
    action: {
      type: 'postback',
      label,
      data
    },
    style,
    height: 'sm',
    flex: 1
  });
  const dpadRows = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [{ type: 'filler' }, makeButton('\u2191', actionData.up), { type: 'filler' }]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        makeButton('\u2190', actionData.left),
        makeButton('OK', actionData.select, 'primary'),
        makeButton('\u2192', actionData.right)
      ],
      margin: 'md'
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [{ type: 'filler' }, makeButton('\u2193', actionData.down), { type: 'filler' }],
      margin: 'md'
    }
  ];
  const menuRow = {
    type: 'box',
    layout: 'horizontal',
    contents: [makeButton('Menu', actionData.menu), makeButton('Home', actionData.home)],
    margin: 'lg'
  };
  const playbackRow = {
    type: 'box',
    layout: 'horizontal',
    contents: [makeButton('Play', actionData.play), makeButton('Pause', actionData.pause)],
    margin: 'md'
  };
  const volumeRow = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      makeButton('Vol +', actionData.volumeUp),
      makeButton('Mute', actionData.mute),
      makeButton('Vol -', actionData.volumeDown)
    ],
    margin: 'md'
  };
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: headerContents
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#EEEEEE'
        },
        ...dpadRows,
        menuRow,
        playbackRow,
        volumeRow
      ],
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
}
function createDeviceControlCard(params) {
  const { deviceName, deviceType, status, isOnline, imageUrl, controls } = params;
  const headerContents = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        // Status dot
        {
          type: 'box',
          layout: 'vertical',
          contents: [],
          width: '10px',
          height: '10px',
          backgroundColor: isOnline !== false ? '#06C755' : '#FF5555',
          cornerRadius: '5px'
        },
        {
          type: 'text',
          text: deviceName,
          weight: 'bold',
          size: 'xl',
          color: '#111111',
          wrap: true,
          flex: 1,
          margin: 'md'
        }
      ],
      alignItems: 'center'
    }
  ];
  if (deviceType) {
    headerContents.push({
      type: 'text',
      text: deviceType,
      size: 'sm',
      color: '#888888',
      margin: 'sm'
    });
  }
  if (status) {
    headerContents.push({
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: status,
          size: 'sm',
          color: '#444444',
          wrap: true
        }
      ],
      margin: 'lg',
      paddingAll: 'md',
      backgroundColor: '#F8F9FA',
      cornerRadius: 'md'
    });
  }
  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF'
    }
  };
  if (imageUrl) {
    bubble.hero = {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '16:9',
      aspectMode: 'cover'
    };
  }
  if (controls.length > 0) {
    const rows = [];
    const limitedControls = controls.slice(0, 6);
    for (let i = 0; i < limitedControls.length; i += 2) {
      const rowButtons = [];
      for (let j = i; j < Math.min(i + 2, limitedControls.length); j++) {
        const ctrl = limitedControls[j];
        const buttonLabel = ctrl.icon ? `${ctrl.icon} ${ctrl.label}` : ctrl.label;
        rowButtons.push({
          type: 'button',
          action: {
            type: 'postback',
            label: buttonLabel.slice(0, 18),
            data: ctrl.data
          },
          style: ctrl.style ?? 'secondary',
          flex: 1,
          height: 'sm',
          margin: j > i ? 'md' : void 0
        });
      }
      if (rowButtons.length === 1) {
        rowButtons.push({
          type: 'filler'
        });
      }
      rows.push({
        type: 'box',
        layout: 'horizontal',
        contents: rowButtons,
        margin: i > 0 ? 'md' : void 0
      });
    }
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: rows,
      paddingAll: 'lg',
      backgroundColor: '#FAFAFA'
    };
  }
  return bubble;
}
function toFlexMessage(altText, contents) {
  return {
    type: 'flex',
    altText,
    contents
  };
}
export {
  createActionCard,
  createAgendaCard,
  createAppleTvRemoteCard,
  createCarousel,
  createDeviceControlCard,
  createEventCard,
  createImageCard,
  createInfoCard,
  createListCard,
  createMediaPlayerCard,
  createNotificationBubble,
  createReceiptCard,
  toFlexMessage
};

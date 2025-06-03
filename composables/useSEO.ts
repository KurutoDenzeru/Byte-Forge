export const useSEO = () => {
  // Set page title and meta tags for the ROM Patcher
  const setRomPatcherSEO = () => {
    useHead({
      title: 'Universal ROM Patcher - Byte Forge',
      meta: [
        {
          name: 'description',
          content: 'Universal ROM Patcher supporting IPS, UPS, BPS, and xDelta patches. Apply and create patches with ease.'
        },
        {
          name: 'keywords',
          content: 'ROM patcher, IPS, UPS, BPS, xDelta, patch, ROM hacking, retro gaming'
        },
        {
          property: 'og:title',
          content: 'Universal ROM Patcher - Byte Forge'
        },
        {
          property: 'og:description',
          content: 'Universal ROM Patcher supporting IPS, UPS, BPS, and xDelta patches. Apply and create patches with ease.'
        },
        {
          property: 'og:type',
          content: 'website'
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image'
        },
        {
          name: 'twitter:title',
          content: 'Universal ROM Patcher - Byte Forge'
        },
        {
          name: 'twitter:description',
          content: 'Universal ROM Patcher supporting IPS, UPS, BPS, and xDelta patches. Apply and create patches with ease.'
        }
      ]
    })
  }

  // Set general SEO for any page
  const setSEO = (options: {
    title: string
    description?: string
    keywords?: string
    ogTitle?: string
    ogDescription?: string
    ogType?: string
    twitterTitle?: string
    twitterDescription?: string
  }) => {
    const meta = [
      {
        name: 'description',
        content: options.description || options.title
      }
    ]

    if (options.keywords) {
      meta.push({
        name: 'keywords',
        content: options.keywords
      })
    }

    // Open Graph tags
    meta.push(
      {
        property: 'og:title',
        content: options.ogTitle || options.title
      },
      {
        property: 'og:description',
        content: options.ogDescription || options.description || options.title
      },
      {
        property: 'og:type',
        content: options.ogType || 'website'
      }
    )

    // Twitter tags
    meta.push(
      {
        name: 'twitter:card',
        content: 'summary_large_image'
      },
      {
        name: 'twitter:title',
        content: options.twitterTitle || options.title
      },
      {
        name: 'twitter:description',
        content: options.twitterDescription || options.description || options.title
      }
    )

    useHead({
      title: options.title,
      meta
    })
  }

  return {
    setRomPatcherSEO,
    setSEO
  }
}

import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'SmartAPIForge - AI-Powered No-Code API Builder';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

/**
 * Dynamic OpenGraph image generation for better social sharing
 * This creates a branded image for link previews on social media
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          backgroundImage: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        }}
      >
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 30% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)',
          }}
        />
        
        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
        >
          {/* Logo/Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
              }}
            >
              <span style={{ fontSize: '32px', color: 'white' }}>⚡</span>
            </div>
            <span
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              SmartAPIForge
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '32px',
              color: '#a5b4fc',
              marginBottom: '40px',
              textAlign: 'center',
            }}
          >
            AI-Powered No-Code API Builder
          </div>

          {/* Features */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '20px',
            }}
          >
            {['Build APIs in Minutes', 'Auto Documentation', 'One-Click Deploy'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <span style={{ color: '#c7d2fe', fontSize: '18px' }}>{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: '40px',
              padding: '16px 48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            Start Building Free →
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            color: '#64748b',
            fontSize: '18px',
          }}
        >
          smartfogeapi.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

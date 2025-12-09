import { FunctionComponent } from 'preact';
import './RichMessageRenderer.css';

interface CarouselItem {
  title: string;
  description?: string;
  imageUrl?: string;
  buttons: { label: string; action: string; value: string }[];
}

interface QuickReplyOption {
  label: string;
  action: string;
  value: string;
}

interface ImageMapArea {
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  value: string;
}

interface RichMessageContent {
  items?: CarouselItem[];
  options?: QuickReplyOption[];
  text?: string;
  buttons?: { label: string; action: string; value: string }[];
  imageUrl?: string;
  areas?: ImageMapArea[];
}

interface RichMessageRendererProps {
  type: 'carousel' | 'quick_reply' | 'button' | 'image_map';
  content: RichMessageContent;
  onAction: (action: string, value: string) => void;
}

export const RichMessageRenderer: FunctionComponent<RichMessageRendererProps> = ({
  type,
  content,
  onAction,
}) => {
  const handleButtonClick = (action: string, value: string) => {
    onAction(action, value);
  };

  if (type === 'carousel') {
    return (
      <div className="rich-message carousel">
        <div className="carousel-container">
          {content.items?.map((item, index) => (
            <div key={index} className="carousel-card">
              {item.imageUrl && (
                <div className="carousel-image">
                  <img src={item.imageUrl} alt={item.title} />
                </div>
              )}
              <div className="carousel-content">
                <h3 className="carousel-title">{item.title}</h3>
                {item.description && (
                  <p className="carousel-description">{item.description}</p>
                )}
                <div className="carousel-buttons">
                  {item.buttons.map((button, btnIndex) => (
                    <button
                      key={btnIndex}
                      className="carousel-button"
                      onClick={() => handleButtonClick(button.action, button.value)}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'quick_reply') {
    return (
      <div className="rich-message quick-reply">
        <div className="quick-reply-options">
          {content.options?.map((option, index) => (
            <button
              key={index}
              className="quick-reply-button"
              onClick={() => handleButtonClick(option.action, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'button') {
    return (
      <div className="rich-message button-template">
        {content.text && <p className="button-template-text">{content.text}</p>}
        <div className="button-template-buttons">
          {content.buttons?.map((button, index) => (
            <button
              key={index}
              className="button-template-button"
              onClick={() => handleButtonClick(button.action, button.value)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'image_map') {
    return (
      <div className="rich-message image-map">
        <div className="image-map-container">
          <img src={content.imageUrl} alt="Image Map" className="image-map-image" />
          {content.areas?.map((area, index) => (
            <div
              key={index}
              className="image-map-area"
              style={{
                position: 'absolute',
                left: `${area.x}%`,
                top: `${area.y}%`,
                width: `${area.width}%`,
                height: `${area.height}%`,
              }}
              onClick={() => handleButtonClick(area.action, area.value)}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
};

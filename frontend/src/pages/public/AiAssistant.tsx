import { AiChat } from '@/components/AiChat';

export default function AiAssistant() {
  return (
    <>
      <div className="ai-hero">
        <div className="container">
          <span className="eyebrow" style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)", borderColor: "rgba(255,255,255,.15)" }}>✨ Powered by <span id="modelLabel">AI</span></span>
          <h1 style={{ color: "#fff", marginTop: "10px" }}>Trợ lý AI Sprouty</h1>
          <p className="lead" style={{ color: "rgba(255,255,255,.55)" }}>Tư vấn chọn kit, chăm cây, IoT/STEM và gợi ý caption cho Cây Kỷ Niệm của bé — 24/7.</p>
          <div className="ai-feat-grid">
            <div className="ai-feat">
              <div className="ai-feat-icon">💬</div>
              <h3>Tư vấn miễn phí</h3>
              <p>Hỏi về bất kỳ sản phẩm, kỹ thuật hay lứa tuổi phù hợp</p>
            </div>
            <div className="ai-feat" id="feat-img">
              <div className="ai-feat-icon">📸</div>
              <h3>Gợi ý kỷ niệm</h3>
              <p>Nhận gợi ý caption, nhật ký và lời nhắc chăm cây từ Plant Buddy</p>
              <span className="tag tag-wh" style={{ marginTop: "8px", fontSize: ".69rem" }}>Yêu cầu đăng nhập</span>
            </div>
            <div className="ai-feat" id="feat-voice">
              <div className="ai-feat-icon">🎙</div>
              <h3>Hỏi bằng giọng nói</h3>
              <p>Nói chuyện trực tiếp bằng tiếng Việt với trợ lý AI</p>
              <span className="tag tag-wh" style={{ marginTop: "8px", fontSize: ".69rem" }}>Yêu cầu đăng nhập</span>
            </div>
          </div>
        </div>
      </div>

      <section className="section-sm">
        <div className="container">
          <AiChat />
        </div>
      </section>
    </>
  );
}

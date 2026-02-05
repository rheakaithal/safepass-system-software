import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: String

    func makeUIView(context: Context) -> WKWebView {
        WKWebView()
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if let link = URL(string: url) {
            webView.load(URLRequest(url: link))
        }
    }
}

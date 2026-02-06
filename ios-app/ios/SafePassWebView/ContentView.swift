struct ContentView: View {
    var body: some View {
        WebView(url: "http://YOUR_SERVER_IP")
            .edgesIgnoringSafeArea(.all)
    }
}

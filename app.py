from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="/", static_url_path="/")

@app.route("/")
def index():
    return app.send_static_file("index.html")

# pour capturer les autres routes HTMX
@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(debug=True, port=5000)

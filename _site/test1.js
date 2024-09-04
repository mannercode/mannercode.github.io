function main() {
    const buffer = "Hello, World!";
    printDocument(buffer);

    const file = new File("test.txt");
    printDocument(file);
    file.close();

    const request = new HttpRequest("https://test.com/api");
    printDocument(request)
}

function printDocument(doc: string | File | HttpRequest) {
    if (typeof doc === 'string') {
        for (let i = 0; i < doc.length; i++) {
            const char = doc.charAt(i);

            console.log(char);
        }
    }
    else if (doc instanceof File) {
        let char = doc.getChar()

        while (char != EOF) {
            console.log(char)
            char = doc.getChar()
        }
    } else if (doc instanceof HttpRequest) {
        const body = doc.body();

        for (let i = 0; i < body.length; i++) {
            const char = body.charAt(i);

            console.log(char);
        }
    }
}

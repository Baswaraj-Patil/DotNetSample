// Read the Consumer Secret set in your Heroku Config Vars
string consumerSecret = Environment.GetEnvironmentVariable("CANVAS_CONSUMER_SECRET") ?? "";

app.MapPost("/canvas", async ([FromForm] string signed_request, HttpContext context) =>
{
    if (string.IsNullOrEmpty(signed_request))
    {
        return Results.BadRequest("Missing signed_request payload.");
    }

    // PRODUCTION SECURITY: Verify that the POST request actually came from your Salesforce Org
    // (You will decode the 'signed_request' string using the 'consumerSecret' key)

    var filePath = Path.Combine(app.Environment.WebRootPath, "index.html");
    return Results.Bytes(await File.ReadAllBytesAsync(filePath), "text/html");
});

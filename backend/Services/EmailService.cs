using System.Net;
using System.Net.Mail;

namespace SportsWeekManager.Services;

public interface IEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default);
}

public sealed class GmailEmailSender(IConfiguration configuration) : IEmailSender
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(configuration["Smtp:Username"])
        && !string.IsNullOrWhiteSpace(configuration["Smtp:AppPassword"])
        && !configuration["Smtp:Username"]!.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)
        && !configuration["Smtp:AppPassword"]!.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase);

    public async Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var username=configuration["Smtp:Username"];
        var password=configuration["Smtp:AppPassword"];
        var from=configuration["Email:FromAddress"] ?? username;
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Gmail SMTP is not configured. Set Smtp:Username and Smtp:AppPassword before using email verification.");
        }
        using var message=new MailMessage(new MailAddress(from!,configuration["Email:FromName"] ?? "SportsWeek Manager"),new MailAddress(recipient)) { Subject=subject, Body=htmlBody, IsBodyHtml=true };
        using var client=new SmtpClient(configuration["Smtp:Host"] ?? "smtp.gmail.com",configuration.GetValue("Smtp:Port",587)) { EnableSsl=true, Credentials=new NetworkCredential(username,password), DeliveryMethod=SmtpDeliveryMethod.Network };
        cancellationToken.ThrowIfCancellationRequested();
        await client.SendMailAsync(message,cancellationToken);
    }
}

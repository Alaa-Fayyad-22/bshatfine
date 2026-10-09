namespace Bshatfine.Domain.Entities;

public class News
{
    public Guid ID { get; set; }
    public string Title { get; set; }
    public string Body { get; set; }
    public DateTime PublishedAt { get; set; }
}

using Bshatfine.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class EventTranslationConfiguration : IEntityTypeConfiguration<EventTranslation>
{
    public void Configure(EntityTypeBuilder<EventTranslation> builder)
    {
        builder.ToTable("EventTranslations");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Language).HasConversion<string>().HasMaxLength(5);
        builder.Property(t => t.Title).HasMaxLength(EventTranslation.TitleMaxLength).IsRequired();
        builder.Property(t => t.Summary).HasMaxLength(EventTranslation.SummaryMaxLength).IsRequired();
        builder.Property(t => t.Body).IsRequired(); // may be an empty string; the 50,000 limit is in the Domain
        builder.Property(t => t.Location).HasMaxLength(EventTranslation.LocationMaxLength).IsRequired();   // may be empty
        builder.Property(t => t.Organizer).HasMaxLength(EventTranslation.OrganizerMaxLength).IsRequired(); // may be empty

        builder.HasIndex(t => new { t.EventId, t.Language }).IsUnique(); // one translation per language
    }
}
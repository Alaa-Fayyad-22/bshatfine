using Bshatfine.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.ToTable("Events");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();

        builder.Property(e => e.Category).HasMaxLength(50).IsRequired();
        builder.Property(e => e.MapUrl).HasMaxLength(Event.MapUrlMaxLength);
        builder.Property(e => e.CoverImagePath).HasMaxLength(300);
        builder.Property(e => e.Version).IsRowVersion(); // PostgreSQL xmin

        builder.HasMany(e => e.Translations)
            .WithOne()
            .HasForeignKey(t => t.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(e => e.Translations).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Public lists: "Upcoming" (FinishesAt >= now) and "Past events" (FinishesAt < now) of published events
        builder.HasIndex(e => new { e.IsPublished, e.FinishesAt });

        // Admin list: newest events first
        builder.HasIndex(e => e.StartsAt);
    }
}
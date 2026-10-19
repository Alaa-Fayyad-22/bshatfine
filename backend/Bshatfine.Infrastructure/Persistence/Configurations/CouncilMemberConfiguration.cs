using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class CouncilMemberConfiguration : IEntityTypeConfiguration<CouncilMember>
{
    public void Configure(EntityTypeBuilder<CouncilMember> builder)
    {
        builder.ToTable("CouncilMembers");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        builder.Property(m => m.NameAr).HasMaxLength(CouncilMember.TextMaxLength).IsRequired();
        builder.Property(m => m.NameEn).HasMaxLength(CouncilMember.TextMaxLength);
        builder.Property(m => m.PositionAr).HasMaxLength(CouncilMember.TextMaxLength).IsRequired();
        builder.Property(m => m.PositionEn).HasMaxLength(CouncilMember.TextMaxLength);
        builder.Property(m => m.PhotoPath).HasMaxLength(300);

        builder.Property(m => m.Version).IsRowVersion(); // PostgreSQL xmin

        // The public page: active members in display order
        builder.HasIndex(m => new { m.IsActive, m.DisplayOrder });
    }
}